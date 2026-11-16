import { redirect } from "next/navigation";
import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { PipelineBoard, type PipelineCard } from "@/components/PipelineBoard";
import { NOVA_STAGE_ID } from "@/lib/pipeline-stages";
import { getDefaultPipeline } from "@/lib/crm/pipeline-config";
import { logError } from "@/lib/log-error";

function daysInStage(stageUpdatedAt: Date | null): string {
  if (!stageUpdatedAt) return "";
  const days = Math.floor((Date.now() - stageUpdatedAt.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "hoje";
  if (days === 1) return "há 1 dia";
  return `há ${days} dias`;
}

function fetchPipelineData(organizationId: string) {
  return withOrgContext(organizationId, async (tx) => {
    const pipeline = await getDefaultPipeline(tx, organizationId);
    // Contas ainda sem negociação entram na primeira coluna ("Oportunidades").
    // O que foi descartado não aparece, senão uma oportunidade descartada na
    // tela de Oportunidades reaparecia aqui.
    const scores = await tx.opportunityScore.findMany({
      where: { organizationId, status: { not: "DISMISSED" } },
      include: {
        company: true,
        account: { include: { opportunities: { include: { stage: true }, orderBy: { createdAt: "desc" }, take: 1 } } },
      },
    });
    const userIds = [...new Set(scores.map((s) => s.account?.opportunities[0]?.lastActionByUserId).filter((id): id is string => !!id))];
    const users = userIds.length ? await tx.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [];
    return { pipeline, scores, users };
  });
}

export default async function PipelinePage() {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  let data: Awaited<ReturnType<typeof fetchPipelineData>> | null = null;
  let dbError = false;
  try {
    data = await fetchPipelineData(organizationId);
  } catch (err) {
    logError("pipeline: falha ao carregar pipeline", err, { organizationId });
    dbError = true;
  }
  if (dbError || !data) return <DbSetupNotice />;

  const userName = new Map(data.users.map((u) => [u.id, u.name || u.email]));
  const cards: PipelineCard[] = data.scores
    .map((sc) => {
      const opp = sc.account?.opportunities[0] ?? null;
      return {
        sortKey: (opp?.stageChangedAt ?? sc.computedAt).getTime(),
        card: {
          id: sc.id,
          companyName: sc.company.name,
          city: sc.company.city,
          state: sc.company.state,
          score: sc.score,
          stage: opp?.stage.key ?? NOVA_STAGE_ID,
          daysLabel: daysInStage(opp?.stageChangedAt ?? null),
          lastActionByName: (opp?.lastActionByUserId && userName.get(opp.lastActionByUserId)) || null,
        } satisfies PipelineCard,
      };
    })
    .sort((a, b) => b.sortKey - a.sortKey)
    .map((x) => x.card);
  const columns = data.pipeline.stages.map((st) => ({ key: st.key, label: st.name, kind: st.kind }));

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

      <PipelineBoard initialCards={cards} stages={columns} />
    </div>
  );
}
