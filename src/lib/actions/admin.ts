"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isCurrentUserSuperAdmin, getCurrentUserId } from "@/lib/auth/current-org";
import { newTrialEndsAt } from "@/lib/trial";
import { sendInviteEmail, INVITE_TTL_MS } from "@/lib/invite-email";
import { logSecurityEvent } from "@/lib/audit/log";
import { emailSchema, firstIssueMessage } from "@/lib/validation";
import type { Plan } from "@/generated/prisma/enums";

// Retorna o userId do super-admin logado — todo call site precisa dele pra
// atribuir a ação a uma pessoa no log de auditoria, não só saber que "algum
// admin" fez.
async function requireSuperAdmin(): Promise<string> {
  const ok = await isCurrentUserSuperAdmin();
  if (!ok) redirect("/");
  const userId = await getCurrentUserId();
  if (!userId) redirect("/");
  return userId;
}

export async function updateOrganizationPlan(organizationId: string, formData: FormData) {
  const actorUserId = await requireSuperAdmin();

  const plan = String(formData.get("plan") ?? "STARTER");

  await prisma.organization.update({
    where: { id: organizationId },
    data: { plan: plan as Plan },
  });
  await logSecurityEvent({
    type: "admin.plan_changed",
    actorUserId,
    organizationId,
    targetId: organizationId,
    metadata: { plan },
  });

  revalidatePath("/admin");
}

export async function extendTrial(organizationId: string, days: number) {
  const actorUserId = await requireSuperAdmin();

  await prisma.organization.update({
    where: { id: organizationId },
    data: { trialEndsAt: newTrialEndsAt(days) },
  });
  await logSecurityEvent({
    type: "admin.trial_extended",
    actorUserId,
    organizationId,
    targetId: organizationId,
    metadata: { days },
  });

  revalidatePath("/admin");
}

export async function removeTrialLimit(organizationId: string) {
  const actorUserId = await requireSuperAdmin();

  await prisma.organization.update({
    where: { id: organizationId },
    data: { trialEndsAt: null },
  });
  await logSecurityEvent({
    type: "admin.trial_limit_removed",
    actorUserId,
    organizationId,
    targetId: organizationId,
  });

  revalidatePath("/admin");
}

export async function adminInviteUser(organizationId: string, formData: FormData) {
  const actorUserId = await requireSuperAdmin();

  const rawEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  const emailResult = emailSchema.safeParse(rawEmail);
  if (!emailResult.success) {
    redirect(`/admin?error=${encodeURIComponent(firstIssueMessage(emailResult.error))}`);
  }
  const email = emailResult.data;

  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) redirect("/admin");

  const existingMember = await prisma.membership.findFirst({ where: { organizationId, user: { email } } });
  if (existingMember) {
    redirect("/admin?error=Essa pessoa já faz parte dessa equipe.");
  }

  const token = crypto.randomUUID();
  await prisma.invite.create({
    data: { organizationId, email, token, expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
  });

  await sendInviteEmail(email, organization.name, token);
  await logSecurityEvent({
    type: "admin.user_invited",
    actorUserId,
    organizationId,
    metadata: { email },
  });

  revalidatePath("/admin");
}

export async function adminRemoveUser(organizationId: string, membershipId: string) {
  const actorUserId = await requireSuperAdmin();

  const memberCount = await prisma.membership.count({ where: { organizationId } });
  if (memberCount <= 1) {
    redirect("/admin?error=Não é possível remover o único usuário de uma empresa.");
  }

  await prisma.membership.deleteMany({ where: { id: membershipId, organizationId } });
  await logSecurityEvent({
    type: "admin.user_removed",
    actorUserId,
    organizationId,
    targetId: membershipId,
  });

  revalidatePath("/admin");
}

export async function adminCancelInvite(organizationId: string, inviteId: string) {
  const actorUserId = await requireSuperAdmin();

  await prisma.invite.deleteMany({ where: { id: inviteId, organizationId } });
  await logSecurityEvent({
    type: "admin.invite_canceled",
    actorUserId,
    organizationId,
    targetId: inviteId,
  });

  revalidatePath("/admin");
}

export async function adminToggleSearchBlock(organizationId: string, membershipId: string) {
  const actorUserId = await requireSuperAdmin();

  const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
  if (!membership || membership.organizationId !== organizationId) redirect("/admin");

  await prisma.membership.update({
    where: { id: membershipId },
    data: { searchBlocked: !membership.searchBlocked },
  });
  await logSecurityEvent({
    type: "admin.search_block_toggled",
    actorUserId,
    organizationId,
    targetId: membershipId,
    metadata: { searchBlocked: !membership.searchBlocked },
  });

  revalidatePath("/admin");
}

// Confirma um pedido de exclusão (LGPD, art. 18) já revisado manualmente:
// apaga a organização de fato (cascade via Prisma cuida de memberships,
// ICPs, opportunity scores, feedbacks, chats, invites e search runs — ver
// onDelete: Cascade no schema). Company/Signal não são tocados, são
// entidades globais. O SecurityEvent do pedido original continua existindo
// depois (organizationId vira uma referência "morta", intencional — é o
// próprio registro de auditoria de que o pedido foi atendido).
export async function confirmOrganizationDeletion(organizationId: string) {
  const actorUserId = await requireSuperAdmin();

  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) redirect("/admin");

  await prisma.organization.delete({ where: { id: organizationId } });

  await logSecurityEvent({
    type: "privacy.deletion_completed",
    actorUserId,
    targetId: organizationId,
    metadata: { organizationName: organization.name },
  });

  revalidatePath("/admin");
}
