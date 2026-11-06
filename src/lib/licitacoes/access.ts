import "server-only";
import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/auth/current-org";
import { prismaAdmin } from "@/lib/prisma-admin";
import { isBiddingEnabled } from "./gating";

// Guarda de TODA rota/ação do módulo Licitações: o menu escondido não é
// segurança, a checagem de verdade é aqui, no servidor. Usa prismaAdmin só
// pra ler a flag da organização (mesmo motivo de current-org.ts: descobrir
// o contexto antes de ele existir).
export async function requireBiddingAccess() {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");

  const org = await prismaAdmin.organization.findUnique({
    where: { id: membership.organizationId },
    select: { id: true, plan: true, biddingEnabled: true },
  });
  if (!org || !isBiddingEnabled(org)) redirect("/");

  return { organizationId: org.id, userId: membership.userId, role: membership.role };
}
