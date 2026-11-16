import { redirect } from "next/navigation";
import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentOrganizationId, getCurrentUserId } from "@/lib/auth/current-org";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { PipelineBoard, type PipelineCard } from "@/components/PipelineBoard";
import { AttentionStrip } from "@/components/crm/AttentionStrip";
import { PipelineSummary } from "@/components/crm/PipelineSummary";
import { OpportunityDrawer } from "@/components/crm/OpportunityDrawer";
import { NOVA_STAGE_ID } from "@/lib/pipeline-stages";
import { getDefaultPipeline } from "@/lib/crm/pipeline-config";
import { getAttention } from "@/lib/crm/attention";
import { getDrawerData } from "@/lib/crm/drawer-data";
import { toWhatsAppUrl } from "@/lib/crm/whatsapp";
import { formatBRL } from "@/lib/crm/money";
import { initials } from "@/lib/initials";
import { logError } from "@/lib/log-error";

function daysInStage(since: Date | null): string {
  if (!since) return "";
  const days = Math.floor((Date.now() - since.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "hoje";
  if (days === 1) return "há 1 dia";
  return `há ${days} dias`;
}

async function fetchPipelineData(organizationId: string, userId: string | null, owner: "me" | "all", openId: string | null) {
  return withOrgContext(organizationId, async (tx) => {
    const pipeline = await getDefaultPipeline(tx, organizationId);
    const now = new Date();
    const ownerFilter = owner === "me" ? userId : null;
    const attention = await getAttention(tx, organizationId, ownerFilter, now);

    // Contas ainda sem negociação entram na primeira coluna ("Oportunidades"). O que
    // foi descartado não aparece, senão uma oportunidade descartada na tela de
    // Oportunidades reaparecia aqui.
    const scores = await tx.opportunityScore.findMany({
      where: { organizationId, status: { not: "DISMISSED" } },
      include: {
        company: true,
        account: {
          include: {
            contacts: { where: { isPrimary: true, anonymizedAt: null }, take: 1 },
            opportunities: { include: { stage: true }, orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    });
    const members = await tx.membership.findMany({ where: { organizationId }, include: { user: { select: { id: true, name: true, email: true } } } });
    const drawer = openId ? await getDrawerData(tx, organizationId, openId) : null;
    return { pipeline, scores, members, attention, drawer, now };
  });
}

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ owner?: string; abrir?: string; erro?: string; salvo?: string }> }) {
  const params = await searchParams;
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");
  const userId = await getCurrentUserId();
  const owner: "me" | "all" = params.owner === "all" ? "all" : "me";

  let data: Awaited<ReturnType<typeof fetchPipelineData>> | null = null;
  try {
    data = await fetchPipelineData(organizationId, userId, owner, params.abrir ?? null);
  } catch (err) {
    logError("pipeline: falha ao carregar pipeline", err, { organizationId });
  }
  if (!data) return <DbSetupNotice />;

  const memberName = new Map(data.members.map((m) => [m.userId, m.user.name || m.user.email]));
  const isMine = (ownerUserId: string | null) => owner === "all" || ownerUserId === null || ownerUserId === userId;

  let hiddenByOwner = 0;
  const stageCount = new Map<string, number>();
  const cards: PipelineCard[] = [];
  for (const sc of data.scores) {
    const deal = sc.account?.opportunities[0] ?? null;
    if (deal && !isMine(deal.ownerUserId)) {
      if (deal.status === "OPEN") hiddenByOwn(deal);
      continue;
    }
    if (deal) stageCount.set(deal.stage.key, (stageCount.get(deal.stage.key) ?? 0) + 1);
    const ownerName = deal?.ownerUserId ? memberName.get(deal.ownerUserId) ?? null : null;
    cards.push({
      id: sc.id,
      companyName: sc.company.name,
      city: sc.company.city,
      state: sc.company.state,
      score: sc.score,
      stage: deal?.stage.key ?? NOVA_STAGE_ID,
      daysLabel: daysInStage(deal?.stageChangedAt ?? null),
      lastActionByName: ownerName,
      hasDeal: !!deal,
      valueLabel: deal?.expectedValueBRL != null ? formatBRL(deal.expectedValueBRL) : null,
      ownerInitials: ownerName ? initials(ownerName) : null,
      whatsappUrl: toWhatsAppUrl(sc.account?.contacts[0]?.phone),
      noNextStep: !!deal && deal.status === "OPEN" && deal.nextActivityAt === null,
      overdue: !!deal && deal.status === "OPEN" && deal.nextActivityAt !== null && deal.nextActivityAt < data.now,
    });
  }
  function hiddenByOwn(d: { id: string }) {
    void d;
    hiddenByOwner++;
  }

  const columns = data.pipeline.stages.map((st) => ({ key: st.key, label: st.name, kind: st.kind }));
  const summaryStages = data.pipeline.stages.map((st) => ({ key: st.key, name: st.name, count: stageCount.get(st.key) ?? 0 }));

  return (
    <div>
      <div className="pt-6 px-4 md:px-10">
        <h1 className="text-[25px] font-medium m-0 mb-1" style={{ fontFamily: "var(--font-display)" }}>
          Pipeline comercial
        </h1>
        <p className="m-0 text-[13.5px]" style={{ color: "var(--fg-muted)" }}>
          Da oportunidade nova até vendida ou perdida. Arraste os cards entre as colunas ou abra um card para ver e agendar o próximo passo.
        </p>
      </div>

      <AttentionStrip attention={data.attention} ownerParam={owner} />
      <PipelineSummary attention={data.attention} stages={summaryStages} />

      {owner === "me" && hiddenByOwner > 0 && (
        <div className="px-4 md:px-10 mt-4 text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
          {hiddenByOwner} {hiddenByOwner === 1 ? "oportunidade aberta de outra pessoa da equipe não aparece" : "oportunidades abertas de outras pessoas da equipe não aparecem"} neste filtro.
        </div>
      )}

      <PipelineBoard initialCards={cards} stages={columns} ownerParam={owner} />

      {data.drawer && params.abrir && (
        <OpportunityDrawer data={data.drawer} scoreId={params.abrir} ownerParam={owner} erro={params.erro} salvo={params.salvo === "1"} now={data.now} />
      )}
    </div>
  );
}
