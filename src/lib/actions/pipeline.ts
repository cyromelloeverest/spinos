"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentOrganizationId, getCurrentUserId } from "@/lib/auth/current-org";
import { withOrgContext } from "@/lib/db/with-org-context";
import { NOVA_STAGE_ID } from "@/lib/pipeline-stages";
import { startInPipeline, moveToStage, dismissAccountForScore, NOVA } from "@/lib/crm/opportunities";

async function requireOrgId(): Promise<string> {
  const orgId = await getCurrentOrganizationId();
  if (!orgId) redirect("/onboarding");
  return orgId;
}

export async function moveToPipeline(opportunityScoreId: string) {
  const organizationId = await requireOrgId();
  const userId = await getCurrentUserId();
  await withOrgContext(organizationId, (tx) => startInPipeline(tx, { organizationId, userId }, opportunityScoreId));
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

  // NOVA_STAGE_ID é o sentinel client-side da coluna "Oportunidades" no
  // quadro — não é uma etapa real: devolve a conta para "oportunidades
  // encontradas" (sem negociação).
  const stageKey = stage === NOVA_STAGE_ID ? NOVA : stage;

  await withOrgContext(organizationId, async (tx) => {
    const { companyId, kind } = await moveToStage(tx, { organizationId, userId }, opportunityScoreId, stageKey);

    if (kind === "WON") {
      await tx.feedback.upsert({
        where: { opportunityScoreId },
        update: { outcome: "CONVERTED", notes: null },
        create: { organizationId, companyId, opportunityScoreId, outcome: "CONVERTED" },
      });
    } else if (kind === "LOST") {
      const outcome = lossReason ?? "NOT_INTERESTED";
      await tx.feedback.upsert({
        where: { opportunityScoreId },
        update: { outcome, notes: lossNotes?.trim() || null },
        create: { organizationId, companyId, opportunityScoreId, outcome, notes: lossNotes?.trim() || null },
      });
    } else {
      // Voltou de um estágio terminal pra um não-terminal — o Feedback antigo
      // não reflete mais a realidade dessa oportunidade.
      await tx.feedback.deleteMany({ where: { opportunityScoreId } });
    }
  });

  revalidatePath("/");
  revalidatePath("/pipeline");
  // Só importa quando isBackToOportunidades, mas revalidar sempre é
  // inofensivo e mais simples do que condicionar.
  revalidatePath("/oportunidades");
}

export async function dismissOpportunity(opportunityScoreId: string) {
  const organizationId = await requireOrgId();
  const userId = await getCurrentUserId();
  await withOrgContext(organizationId, (tx) => dismissAccountForScore(tx, { organizationId, userId }, opportunityScoreId));
  revalidatePath("/");
  revalidatePath("/oportunidades");
  redirect("/oportunidades");
}
