import { redirect } from "next/navigation";
import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { PipelineBoard, type PipelineCard } from "@/components/PipelineBoard";
import { NOVA_STAGE_ID } from "@/lib/pipeline-stages";
import { logError } from "@/lib/log-error";

function daysInStage(stageUpdatedAt: Date | null): string {
  if (!stageUpdatedAt) return "";
  const days = Math.floor((Date.now() - stageUpdatedAt.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "hoje";
  if (days === 1) return "há 1 dia";
  return `há ${days} dias`;
}

function fetchPipelineOpportunities(organizationId: string) {
  return withOrgContext(organizationId, (tx) =>
    tx.opportunityScore.findMany({
      // Inclui stage: null agora — vira a primeira coluna do quadro
      // ("Oportunidades", ver NOVA_STAGE_ID). status ainda filtra
      // DISMISSED, senão uma oportunidade descartada na tela de
      // Oportunidades reaparecia aqui.
      where: { organizationId, status: { not: "DISMISSED" } },
      include: { company: true, lastActionByUser: true },
      orderBy: [{ stageUpdatedAt: "desc" }, { computedAt: "desc" }],
    }),
  );
}

export default async function PipelinePage() {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  let opportunities: Awaited<ReturnType<typeof fetchPipelineOpportunities>> = [];
  let dbError = false;
  try {
    opportunities = await fetchPipelineOpportunities(organizationId);
  } catch (err) {
    logError("pipeline: falha ao carregar pipeline", err, { organizationId });
    dbError = true;
  }
  if (dbError) return <DbSetupNotice />;

  const cards: PipelineCard[] = opportunities.map((opp) => ({
    id: opp.id,
    companyName: opp.company.name,
    city: opp.company.city,
    state: opp.company.state,
    score: opp.score,
    stage: opp.stage ?? NOVA_STAGE_ID,
    daysLabel: daysInStage(opp.stageUpdatedAt),
    lastActionByName: opp.lastActionByUser?.name || opp.lastActionByUser?.email || null,
  }));

  return (
    <div>
      <div className="pt-6 px-4 md:px-10">
        <h1 className="text-[25px] font-medium m-0 mb-1" style={{ fontFamily: "var(--font-display)" }}>
          Pipeline comercial
        </h1>
        <p className="m-0 text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
          Da oportunidade nova até vendida ou perdida. Arraste os cards entre as colunas para atualizar o estágio.
        </p>
      </div>

      <PipelineBoard initialCards={cards} />
    </div>
  );
}
