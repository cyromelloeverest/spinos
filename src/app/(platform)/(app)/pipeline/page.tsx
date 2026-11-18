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
import { getInstalledPack } from "@/lib/crm/pack-install";
import { renderMessage } from "@/packs/registry";
import { formatBRL } from "@/lib/crm/money";
import { initials } from "@/lib/initials";
import { logError } from "@/lib/log-error";
import { PageHeader } from "@/components/PageHeader";

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
    // Leads (entraram por formulário ou cadastro manual) não têm nota da IA: entram direto pela negociação.
    const leadDeals = await tx.opportunity.findMany({
      where: { organizationId, account: { is: { scores: { none: {} } } } },
      include: { stage: true, account: { include: { contacts: { where: { isPrimary: true, anonymizedAt: null }, take: 1 } } } },
    });
    const members = await tx.membership.findMany({ where: { organizationId }, include: { user: { select: { id: true, name: true, email: true } } } });
    const drawer = openId ? await getDrawerData(tx, organizationId, openId) : null;
    // Mensagens prontas do pacote de nicho, com as variáveis já preenchidas.
    let messages: { key: string; title: string; channel: string; text: string; url: string | null }[] = [];
    if (drawer) {
      const pack = await getInstalledPack(tx, organizationId);
      if (pack) {
        const org = await tx.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
        const me = members.find((m) => m.userId === userId)?.user;
        const primary = drawer.contacts.find((c) => c.isPrimary) ?? drawer.contacts[0] ?? null;
        const stageKey = drawer.deal?.stage.key ?? pipeline.stages.find((s) => s.kind === "OPEN")?.key;
        const values = {
          nome: primary?.name.split(" ")[0],
          empresa: drawer.company.name,
          escritorio: org?.name,
          seu_nome: (me?.name || me?.email || "").split(" ")[0],
        };
        messages = pack.messages
          .filter((m) => m.stageKeys.length === 0 || (stageKey !== undefined && m.stageKeys.includes(stageKey)))
          .map((m) => {
            const text = renderMessage(m.body, values);
            return { key: m.key, title: m.title, channel: m.channel, text, url: m.channel === "WHATSAPP" ? toWhatsAppUrl(primary?.phone, text) : null };
          });
      }
    }
    return { pipeline, scores, leadDeals, members, attention, drawer, messages, now };
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
      valueBRL: deal?.expectedValueBRL ?? null,
      ownerInitials: ownerName ? initials(ownerName) : null,
      whatsappUrl: toWhatsAppUrl(sc.account?.contacts[0]?.phone),
      noNextStep: !!deal && deal.status === "OPEN" && deal.nextActivityAt === null,
      overdue: !!deal && deal.status === "OPEN" && deal.nextActivityAt !== null && deal.nextActivityAt < data.now,
    });
  }
  for (const deal of data.leadDeals) {
    if (!isMine(deal.ownerUserId)) {
      if (deal.status === "OPEN") hiddenByOwner++;
      continue;
    }
    stageCount.set(deal.stage.key, (stageCount.get(deal.stage.key) ?? 0) + 1);
    const ownerName = deal.ownerUserId ? memberName.get(deal.ownerUserId) ?? null : null;
    cards.push({
      id: deal.id,
      companyName: deal.account.name,
      city: deal.account.city,
      state: deal.account.state,
      score: 0,
      stage: deal.stage.key,
      daysLabel: daysInStage(deal.stageChangedAt),
      lastActionByName: ownerName,
      hasDeal: true,
      valueLabel: deal.expectedValueBRL != null ? formatBRL(deal.expectedValueBRL) : null,
      valueBRL: deal.expectedValueBRL ?? null,
      ownerInitials: ownerName ? initials(ownerName) : null,
      whatsappUrl: toWhatsAppUrl(deal.account.contacts[0]?.phone),
      noNextStep: deal.status === "OPEN" && deal.nextActivityAt === null,
      overdue: deal.status === "OPEN" && deal.nextActivityAt !== null && deal.nextActivityAt < data.now,
      isLead: true,
    });
  }
  function hiddenByOwn(d: { id: string }) {
    void d;
    hiddenByOwner++;
  }

  const columns = data.pipeline.stages.map((st) => ({ key: st.key, label: st.name, kind: st.kind }));
  const summaryStages = data.pipeline.stages.map((st) => ({ key: st.key, name: st.name, kind: st.kind, count: stageCount.get(st.key) ?? 0 }));

  return (
    <div>
      <PageHeader inset title="CRM comercial">
        Da oportunidade nova até vendida ou perdida. Arraste os cards entre as colunas ou abra um card para ver e agendar o próximo passo.
      </PageHeader>

      <AttentionStrip attention={data.attention} ownerParam={owner} />
      <PipelineSummary attention={data.attention} stages={summaryStages} />

      {owner === "me" && hiddenByOwner > 0 && (
        <div className="px-4 md:px-10 mt-4 text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
          {hiddenByOwner} {hiddenByOwner === 1 ? "oportunidade aberta de outra pessoa da equipe não aparece" : "oportunidades abertas de outras pessoas da equipe não aparecem"} neste filtro.
        </div>
      )}

      <PipelineBoard initialCards={cards} stages={columns} ownerParam={owner} />

      {data.drawer && params.abrir && (
        <OpportunityDrawer data={data.drawer} messages={data.messages} scoreId={params.abrir} ownerParam={owner} erro={params.erro} salvo={params.salvo === "1"} now={data.now} />
      )}
    </div>
  );
}
