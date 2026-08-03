"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganizationId, getCurrentUserId } from "@/lib/auth/current-org";

async function requireOrgId(): Promise<string> {
  const orgId = await getCurrentOrganizationId();
  if (!orgId) redirect("/onboarding");
  return orgId;
}

export async function moveToPipeline(opportunityScoreId: string) {
  const organizationId = await requireOrgId();
  const userId = await getCurrentUserId();
  await prisma.opportunityScore.update({
    where: { id: opportunityScoreId, organizationId },
    data: { stage: "CONTATO_FEITO", stageUpdatedAt: new Date(), lastActionByUserId: userId, lastActionAt: new Date() },
  });
  revalidatePath("/");
  revalidatePath("/oportunidades");
  revalidatePath("/pipeline");
  redirect("/pipeline");
}

export async function setStage(opportunityScoreId: string, stage: string) {
  const organizationId = await requireOrgId();
  const userId = await getCurrentUserId();
  await prisma.opportunityScore.update({
    where: { id: opportunityScoreId, organizationId },
    data: {
      stage: stage as "CONTATO_FEITO" | "VISITA_AGENDADA" | "PROPOSTA_ENVIADA" | "VENDIDO" | "PERDIDO",
      stageUpdatedAt: new Date(),
      lastActionByUserId: userId,
      lastActionAt: new Date(),
    },
  });
  revalidatePath("/");
  revalidatePath("/pipeline");
}

export async function dismissOpportunity(opportunityScoreId: string) {
  const organizationId = await requireOrgId();
  const userId = await getCurrentUserId();
  await prisma.opportunityScore.update({
    where: { id: opportunityScoreId, organizationId },
    data: { status: "DISMISSED", lastActionByUserId: userId, lastActionAt: new Date() },
  });
  revalidatePath("/");
  revalidatePath("/oportunidades");
  redirect("/oportunidades");
}
