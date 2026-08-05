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

export type LossReason = "NOT_INTERESTED" | "WRONG_FIT" | "NO_RESPONSE";

// Move o card e grava (ou apaga) o Feedback correspondente — esse é o único
// sinal de calibração que nenhum concorrente tem acesso, então precisa ficar
// sempre consistente com o estágio real, não só acumular.
export async function setStage(
  opportunityScoreId: string,
  stage: string,
  lossReason?: LossReason,
  lossNotes?: string,
) {
  const organizationId = await requireOrgId();
  const userId = await getCurrentUserId();

  const updated = await prisma.opportunityScore.update({
    where: { id: opportunityScoreId, organizationId },
    data: {
      stage: stage as "CONTATO_FEITO" | "VISITA_AGENDADA" | "PROPOSTA_ENVIADA" | "VENDIDO" | "PERDIDO",
      stageUpdatedAt: new Date(),
      lastActionByUserId: userId,
      lastActionAt: new Date(),
    },
    select: { id: true, companyId: true },
  });

  if (stage === "VENDIDO") {
    await prisma.feedback.upsert({
      where: { opportunityScoreId: updated.id },
      update: { outcome: "CONVERTED", notes: null },
      create: {
        organizationId,
        companyId: updated.companyId,
        opportunityScoreId: updated.id,
        outcome: "CONVERTED",
      },
    });
  } else if (stage === "PERDIDO") {
    const outcome = lossReason ?? "NOT_INTERESTED";
    await prisma.feedback.upsert({
      where: { opportunityScoreId: updated.id },
      update: { outcome, notes: lossNotes?.trim() || null },
      create: {
        organizationId,
        companyId: updated.companyId,
        opportunityScoreId: updated.id,
        outcome,
        notes: lossNotes?.trim() || null,
      },
    });
  } else {
    // Voltou de um estágio terminal pra um não-terminal — o Feedback antigo
    // não reflete mais a realidade dessa oportunidade.
    await prisma.feedback.deleteMany({ where: { opportunityScoreId: updated.id } });
  }

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
