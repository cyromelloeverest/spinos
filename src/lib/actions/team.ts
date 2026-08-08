"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prismaAdmin } from "@/lib/prisma-admin";
import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentMembership, getCurrentUserId, setActiveOrganizationCookie } from "@/lib/auth/current-org";
import { translateAuthError } from "@/lib/auth/error-messages";
import { getPlan } from "@/lib/plans";
import { SITE_URL } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { sendInviteEmail, INVITE_TTL_MS } from "@/lib/invite-email";
import { logSecurityEvent } from "@/lib/audit/log";
import { emailSchema, passwordSchema, firstIssueMessage } from "@/lib/validation";

async function requireOwnerOrAdmin() {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/onboarding");
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    redirect("/settings/equipe?error=Apenas donos e administradores podem gerenciar a equipe.");
  }
  return membership;
}

export async function inviteMember(formData: FormData) {
  const membership = await requireOwnerOrAdmin();
  const rawEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  const emailResult = emailSchema.safeParse(rawEmail);
  if (!emailResult.success) {
    redirect(`/settings/equipe?error=${encodeURIComponent(firstIssueMessage(emailResult.error))}`);
  }
  const email = emailResult.data;

  await withOrgContext(membership.organizationId, async (tx) => {
    const organization = await tx.organization.findUnique({ where: { id: membership.organizationId } });
    if (!organization) redirect("/settings/equipe");

    const plan = getPlan(organization.plan);
    if (plan.maxUsers !== null) {
      const [memberCount, pendingInviteCount] = await Promise.all([
        tx.membership.count({ where: { organizationId: organization.id } }),
        tx.invite.count({
          where: { organizationId: organization.id, acceptedAt: null, expiresAt: { gt: new Date() } },
        }),
      ]);
      if (memberCount + pendingInviteCount >= plan.maxUsers) {
        redirect(`/settings/equipe?error=${encodeURIComponent(`Seu plano (${plan.name}) permite até ${plan.maxUsers} usuário(s). Evolua de plano para convidar mais gente.`)}`);
      }
    }

    const existingMember = await tx.membership.findFirst({
      where: { organizationId: organization.id, user: { email } },
    });
    if (existingMember) {
      redirect("/settings/equipe?error=Essa pessoa já faz parte da equipe.");
    }

    const token = crypto.randomUUID();
    await tx.invite.create({
      data: {
        organizationId: organization.id,
        email,
        token,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });

    await sendInviteEmail(email, organization.name, token);
    await logSecurityEvent({
      type: "team.member_invited",
      actorUserId: membership.userId,
      organizationId: organization.id,
      metadata: { email },
    });
  });

  revalidatePath("/settings/equipe");
  redirect("/settings/equipe?invited=1");
}

export async function cancelInvite(inviteId: string) {
  const membership = await requireOwnerOrAdmin();
  await withOrgContext(membership.organizationId, (tx) =>
    tx.invite.deleteMany({ where: { id: inviteId, organizationId: membership.organizationId } }),
  );
  await logSecurityEvent({
    type: "team.invite_canceled",
    actorUserId: membership.userId,
    organizationId: membership.organizationId,
    targetId: inviteId,
  });
  revalidatePath("/settings/equipe");
}

export async function removeMember(membershipId: string) {
  const membership = await requireOwnerOrAdmin();
  const userId = await getCurrentUserId();

  await withOrgContext(membership.organizationId, async (tx) => {
    // Sob o contexto da org do admin, RLS só acha essa linha se ela for
    // dessa mesma org — o "target.organizationId !== membership.organizationId"
    // de antes virava checagem em JS, agora é o próprio banco que nega.
    const target = await tx.membership.findUnique({ where: { id: membershipId } });
    if (!target) return;
    if (target.userId === userId) {
      redirect("/settings/equipe?error=Você não pode remover a si mesmo.");
    }

    await tx.membership.delete({ where: { id: membershipId } });
  });

  await logSecurityEvent({
    type: "team.member_removed",
    actorUserId: userId,
    organizationId: membership.organizationId,
    targetId: membershipId,
  });
  revalidatePath("/settings/equipe");
}

// prismaAdmin de propósito: busca o convite PELO TOKEN — a organização só é
// conhecida depois de achar o convite, não antes.
async function getValidInvite(token: string) {
  const invite = await prismaAdmin.invite.findUnique({ where: { token } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) return null;
  return invite;
}

export async function acceptInviteSignUp(token: string, formData: FormData) {
  const invite = await getValidInvite(token);
  if (!invite) redirect("/convite/invalido");

  const password = String(formData.get("password") ?? "");
  const passwordResult = passwordSchema.safeParse(password);
  if (!passwordResult.success) {
    redirect(`/convite/${token}?error=${encodeURIComponent(firstIssueMessage(passwordResult.error))}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: invite.email,
    password,
    options: { emailRedirectTo: `${SITE_URL}/auth/confirm?next=${encodeURIComponent(`/aceitar-convite/${token}`)}` },
  });

  if (error) {
    redirect(`/convite/${token}?error=${encodeURIComponent(translateAuthError(error.message))}`);
  }

  if (data.user) {
    // prismaAdmin: cria o User antes de qualquer Membership existir.
    await prismaAdmin.user.upsert({
      where: { id: data.user.id },
      update: {},
      create: { id: data.user.id, email: invite.email },
    });
  }

  if (!data.session) {
    redirect("/signup/verifique-seu-email");
  }

  redirect(`/aceitar-convite/${token}`);
}

export async function finalizeInviteAcceptance(token: string) {
  const invite = await getValidInvite(token);
  if (!invite) redirect("/convite/invalido");

  const userId = await getCurrentUserId();
  if (!userId) redirect(`/login?next=${encodeURIComponent(`/aceitar-convite/${token}`)}`);

  // prismaAdmin: confirma o e-mail do usuário atual antes de ele ter
  // qualquer Membership na org do convite.
  const user = await prismaAdmin.user.findUnique({ where: { id: userId } });
  if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
    redirect("/convite/invalido");
  }

  // Agora sim sabemos a org (a do convite) — esse é o momento de conceder
  // acesso a ela, então já dá pra usar o contexto restrito.
  await withOrgContext(invite.organizationId, (tx) =>
    Promise.all([
      tx.membership.upsert({
        where: { userId_organizationId: { userId, organizationId: invite.organizationId } },
        update: {},
        create: { userId, organizationId: invite.organizationId, role: invite.role },
      }),
      tx.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
    ]),
  );
  await logSecurityEvent({
    type: "team.invite_accepted",
    actorUserId: userId,
    actorEmail: invite.email,
    organizationId: invite.organizationId,
    metadata: { role: invite.role },
  });

  // Se o usuário já tinha outra organização, sem isso ele cairia de volta
  // nela — a org do convite recém-aceito deve ser o que ele vê agora.
  await setActiveOrganizationCookie(invite.organizationId);

  redirect("/");
}
