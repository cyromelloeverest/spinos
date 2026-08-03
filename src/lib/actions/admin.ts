"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isCurrentUserSuperAdmin } from "@/lib/auth/current-org";
import { newTrialEndsAt } from "@/lib/trial";
import { sendInviteEmail, INVITE_TTL_MS } from "@/lib/invite-email";
import type { Plan } from "@/generated/prisma/enums";

async function requireSuperAdmin() {
  const ok = await isCurrentUserSuperAdmin();
  if (!ok) redirect("/");
}

export async function updateOrganizationPlan(organizationId: string, formData: FormData) {
  await requireSuperAdmin();

  const plan = String(formData.get("plan") ?? "STARTER");

  await prisma.organization.update({
    where: { id: organizationId },
    data: { plan: plan as Plan },
  });

  revalidatePath("/admin");
}

export async function extendTrial(organizationId: string, days: number) {
  await requireSuperAdmin();

  await prisma.organization.update({
    where: { id: organizationId },
    data: { trialEndsAt: newTrialEndsAt(days) },
  });

  revalidatePath("/admin");
}

export async function removeTrialLimit(organizationId: string) {
  await requireSuperAdmin();

  await prisma.organization.update({
    where: { id: organizationId },
    data: { trialEndsAt: null },
  });

  revalidatePath("/admin");
}

export async function adminInviteUser(organizationId: string, formData: FormData) {
  await requireSuperAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    redirect("/admin?error=Informe um e-mail.");
  }

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

  revalidatePath("/admin");
}

export async function adminRemoveUser(organizationId: string, membershipId: string) {
  await requireSuperAdmin();

  const memberCount = await prisma.membership.count({ where: { organizationId } });
  if (memberCount <= 1) {
    redirect("/admin?error=Não é possível remover o único usuário de uma empresa.");
  }

  await prisma.membership.deleteMany({ where: { id: membershipId, organizationId } });

  revalidatePath("/admin");
}

export async function adminCancelInvite(organizationId: string, inviteId: string) {
  await requireSuperAdmin();

  await prisma.invite.deleteMany({ where: { id: inviteId, organizationId } });

  revalidatePath("/admin");
}

export async function adminToggleSearchBlock(organizationId: string, membershipId: string) {
  await requireSuperAdmin();

  const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
  if (!membership || membership.organizationId !== organizationId) redirect("/admin");

  await prisma.membership.update({
    where: { id: membershipId },
    data: { searchBlocked: !membership.searchBlocked },
  });

  revalidatePath("/admin");
}
