"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, getCurrentMembership } from "@/lib/auth/current-org";
import { logSecurityEvent } from "@/lib/audit/log";
import { sendDeletionRequestEmail } from "@/lib/privacy-email";

// Status do Stripe que indicam assinatura viva — bloqueia a exclusão até o
// usuário cancelar primeiro pelo portal (decisão: exclusão nunca cancela
// cobrança sozinha, pra não haver dúvida de "quem cancelou o quê").
const LIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due"]);

export async function requestAccountDeletion() {
  const userId = await getCurrentUserId();
  const membership = await getCurrentMembership();
  if (!userId || !membership) redirect("/login");

  if (membership.role !== "OWNER") {
    redirect("/settings/empresa?privacidadeError=" + encodeURIComponent("Somente o dono da conta pode solicitar a exclusão da organização."));
  }

  const [user, organization] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.organization.findUnique({ where: { id: membership.organizationId } }),
  ]);
  if (!user || !organization) redirect("/settings/empresa");

  if (organization.subscriptionStatus && LIVE_SUBSCRIPTION_STATUSES.has(organization.subscriptionStatus)) {
    redirect(
      "/settings/empresa?privacidadeError=" +
        encodeURIComponent("Cancele sua assinatura ativa (em Assinatura → Gerenciar assinatura) antes de solicitar a exclusão da conta."),
    );
  }

  await logSecurityEvent({
    type: "privacy.deletion_requested",
    actorUserId: userId,
    actorEmail: user.email,
    organizationId: organization.id,
    targetId: organization.id,
    metadata: { organizationName: organization.name, requesterName: user.name, requesterEmail: user.email },
  });

  await sendDeletionRequestEmail({
    organizationName: organization.name,
    organizationId: organization.id,
    requesterName: user.name,
    requesterEmail: user.email,
  });

  redirect("/settings/empresa?exclusaoSolicitada=1");
}
