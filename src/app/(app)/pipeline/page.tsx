import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { PipelineBoard, type PipelineCard } from "@/components/PipelineBoard";

function daysInStage(stageUpdatedAt: Date | null): string {
  if (!stageUpdatedAt) return "";
  const days = Math.floor((Date.now() - stageUpdatedAt.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "hoje";
  if (days === 1) return "há 1 dia";
  return `há ${days} dias`;
}

function fetchPipelineOpportunities(organizationId: string) {
  return prisma.opportunityScore.findMany({
    where: { organizationId, stage: { not: null } },
    include: { company: true },
    orderBy: { stageUpdatedAt: "desc" },
  });
}

export default async function PipelinePage() {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  let opportunities: Awaited<ReturnType<typeof fetchPipelineOpportunities>> = [];
  let dbError = false;
  try {
    opportunities = await fetchPipelineOpportunities(organizationId);
  } catch {
    dbError = true;
  }
  if (dbError) return <DbSetupNotice />;

  const cards: PipelineCard[] = opportunities.map((opp) => ({
    id: opp.id,
    companyName: opp.company.name,
    city: opp.company.city,
    state: opp.company.state,
    score: opp.score,
    stage: opp.stage!,
    daysLabel: daysInStage(opp.stageUpdatedAt),
  }));

  return (
    <div>
      <div className="pt-6 px-10">
        <h1 className="text-[25px] font-medium m-0 mb-1" style={{ fontFamily: "var(--font-display)" }}>
          Pipeline comercial
        </h1>
        <p className="m-0 text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
          Oportunidades que você já começou a trabalhar. Arraste os cards entre as colunas para atualizar o estágio.
        </p>
      </div>

      <PipelineBoard initialCards={cards} />
    </div>
  );
}
