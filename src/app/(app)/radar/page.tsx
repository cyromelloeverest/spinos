import { redirect } from "next/navigation";
import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { candidatesForIcp, type CandidateSignal } from "@/lib/free-signals/match";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { EmptyState } from "@/components/EmptyState";
import { SignalImage } from "@/components/SignalImage";
import { SpinosScore } from "@/components/SpinosScore";
import { faviconUrl } from "@/lib/favicon";
import { SIGNAL_CATEGORY_LABEL, SIGNAL_CATEGORY_ICON } from "@/lib/signal-categories";
import { ExternalLink, Flame } from "lucide-react";
import { initials } from "@/lib/initials";
import { logError } from "@/lib/log-error";

const SOURCE_LABEL: Record<string, string> = {
  ai_web_search: "Busca sob demanda",
  rss_free: "Monitoramento automático",
  pncp_free: "Edital público",
};

// Quantos dias de sinais gratuitos ainda-não-confirmados olhar pra trás —
// sinais mais antigos que isso perderam relevância pra aparecer como "novidade".
const RAW_SIGNAL_LOOKBACK_DAYS = 21;

function formatRelativeDate(date: Date): string {
  const diffDays = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `Há ${diffDays} dias`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

// O título de sinais mais antigos é só o nome (ou o rótulo) da categoria —
// nesse caso a descrição, mais específica, é a manchete melhor.
function headlineFor(signal: { title: string; category: string; description: string | null }, categoryLabel: string): string {
  const generic = signal.title.trim().toUpperCase() === signal.category || signal.title.trim() === categoryLabel;
  if (generic && signal.description) return signal.description;
  return signal.title;
}

function fetchStories(organizationId: string) {
  return withOrgContext(organizationId, (tx) =>
    tx.opportunityScoreSignal.findMany({
      where: { opportunityScore: { organizationId, status: { not: "DISMISSED" } } },
      include: {
        signal: { include: { company: true } },
        opportunityScore: { select: { id: true, urgency: true, score: true } },
      },
      orderBy: { signal: { detectedAt: "desc" } },
    }),
  );
}

// Sinais da coleta gratuita (RSS/PNCP) que batem com o ICP da organização
// por palavra-chave, mas ainda não viraram uma Oportunidade completa — hoje
// isso ficava invisível pra sempre. Mesmo pré-filtro determinístico do
// match.ts (zero custo de IA), só que aqui é pra exibir, não pra enriquecer.
async function fetchRawCandidates(organizationId: string) {
  const icp = await withOrgContext(organizationId, (tx) =>
    tx.iCP.findFirst({ where: { organizationId, isActive: true }, orderBy: { createdAt: "desc" } }),
  );
  if (!icp) return [];

  // signals é tabela global (RLS: global_read), mas o filtro "none" abaixo
  // faz join/subquery em opportunity_score_signals -> opportunity_scores,
  // que SÃO tenant-scoped — sem contexto de org setado, RLS esconderia essas
  // linhas e o "none" daria falso-positivo (sinal já vinculado reaparecendo
  // como novo). Por isso essa query também precisa ir dentro do contexto.
  const cutoff = new Date(Date.now() - RAW_SIGNAL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const signals = await withOrgContext(organizationId, (tx) =>
    tx.signal.findMany({
      where: {
        sourceType: { in: ["rss_free", "pncp_free"] },
        detectedAt: { gte: cutoff },
        opportunityScoreSignals: { none: { opportunityScore: { organizationId } } },
      },
      include: { company: true },
      orderBy: { detectedAt: "desc" },
      take: 200,
    }),
  );

  const pool: CandidateSignal[] = signals.map((s) => ({
    signalId: s.id,
    companyId: s.companyId,
    companyName: s.company.name,
    city: s.company.city,
    state: s.company.state,
    segment: s.company.segment,
    category: s.category,
    title: s.title,
    description: s.description,
  }));

  const matchedIds = new Set(candidatesForIcp(icp, pool).map((c) => c.signalId));
  return signals.filter((s) => matchedIds.has(s.id));
}

export default async function NewsPage() {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  let links: Awaited<ReturnType<typeof fetchStories>> = [];
  let rawSignals: Awaited<ReturnType<typeof fetchRawCandidates>> = [];
  let dbError = false;
  try {
    [links, rawSignals] = await Promise.all([fetchStories(organizationId), fetchRawCandidates(organizationId)]);
  } catch (err) {
    logError("radar: falha ao carregar sinais", err, { organizationId });
    dbError = true;
  }
  if (dbError) return <DbSetupNotice />;

  // Um sinal global pode estar ligado a mais de uma oportunidade desta
  // organização (ex: dois ICPs diferentes casando com a mesma empresa) — o
  // feed mostra cada sinal uma única vez.
  const seen = new Set<string>();
  const stories: Story[] = links
    .filter((l) => {
      if (seen.has(l.signal.id)) return false;
      seen.add(l.signal.id);
      return true;
    })
    .map((l) => ({ kind: "linked", signal: l.signal, opportunityScore: l.opportunityScore, detectedAt: l.signal.detectedAt }));

  const rawStories: Story[] = rawSignals.map((s) => ({ kind: "raw", signal: s, company: s.company, detectedAt: s.detectedAt }));

  const feed = [...stories, ...rawStories].sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());

  return (
    <div>
      <div className="pt-6 px-4 md:px-10">
        <h1 className="text-[25px] font-medium m-0 mb-1" style={{ fontFamily: "var(--font-display)" }}>
          Radar
        </h1>
        <p className="m-0 text-[13.5px] max-w-[60ch]" style={{ color: "var(--fg-muted)" }}>
          Todos os sinais e novidades encontrados sobre as empresas que você está de olho, em ordem cronológica —
          inclusive o que nosso monitoramento automático (notícias e editais públicos) encontra sozinho todo dia.
        </p>
      </div>

      <div className="px-4 md:px-10 pt-6 pb-16 max-w-[640px] mx-auto flex flex-col gap-4">
        {feed.length === 0 && (
          <EmptyState message="Nenhuma notícia ainda — rode uma busca de oportunidades pra começar a coletar sinais." />
        )}

        {feed.map((story) => (story.kind === "linked" ? <FeedCard key={story.signal.id} story={story} /> : <RawFeedCard key={story.signal.id} story={story} />))}
      </div>
    </div>
  );
}

type LinkedStory = {
  kind: "linked";
  signal: Awaited<ReturnType<typeof fetchStories>>[number]["signal"];
  opportunityScore: { id: string; urgency: string; score: number };
  detectedAt: Date;
};
type RawStory = {
  kind: "raw";
  signal: Awaited<ReturnType<typeof fetchRawCandidates>>[number];
  company: Awaited<ReturnType<typeof fetchRawCandidates>>[number]["company"];
  detectedAt: Date;
};
type Story = LinkedStory | RawStory;

function CategoryBadge({ category }: { category: string }) {
  const label = SIGNAL_CATEGORY_LABEL[category] ?? SIGNAL_CATEGORY_LABEL.OTHER;
  const Icon = SIGNAL_CATEGORY_ICON[category] ?? SIGNAL_CATEGORY_ICON.OTHER;
  return (
    <div
      className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase rounded-full px-2.5 py-1 flex-shrink-0"
      style={{ background: "var(--card-hover)", color: "var(--fg-muted)", letterSpacing: "0.05em" }}
    >
      <Icon size={11} strokeWidth={2} />
      {label}
    </div>
  );
}

// Mesmo tratamento neutro do CategoryBadge — só o texto muda. Diferenciar
// origem é sobre contexto, não sobre "isso vale menos" (dado do PNCP é tão
// verificável quanto o achado pela IA, às vezes mais).
function SourceBadge({ sourceType }: { sourceType: string }) {
  const label = SOURCE_LABEL[sourceType] ?? "Sinal público";
  return (
    <div
      className="inline-flex items-center text-[10.5px] font-medium rounded-full px-2.5 py-1 flex-shrink-0"
      style={{ background: "var(--card-hover)", color: "var(--fg-faint)" }}
    >
      {label}
    </div>
  );
}

function CompanyAvatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center font-bold flex-shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: "var(--primary-soft)",
        color: "var(--primary)",
        fontSize: Math.round(size * 0.34),
      }}
    >
      {initials(name)}
    </div>
  );
}

function UrgencyFlag({ urgency }: { urgency: string }) {
  if (urgency !== "ALTA") return null;
  return <Flame size={12} strokeWidth={2} style={{ color: "var(--primary)" }} className="flex-shrink-0" />;
}

function SourceLink({ sourceUrl }: { sourceUrl: string | null }) {
  if (!sourceUrl) return null;
  const favicon = faviconUrl(sourceUrl);
  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noreferrer"
      className="text-[12px] inline-flex items-center gap-1.5 font-medium no-underline flex-shrink-0"
      style={{ color: "var(--primary)" }}
    >
      {favicon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={favicon} alt="" width={14} height={14} className="rounded-[3px]" />
      )}
      Ver fonte
      <ExternalLink size={12} strokeWidth={1.75} />
    </a>
  );
}

function FeedCard({ story }: { story: LinkedStory }) {
  const { signal, opportunityScore } = story;
  const headline = headlineFor(signal, SIGNAL_CATEGORY_LABEL[signal.category] ?? SIGNAL_CATEGORY_LABEL.OTHER);

  return (
    <article
      className="rounded-[16px] border overflow-hidden"
      style={{ borderColor: "var(--border)", background: "var(--card)", boxShadow: "var(--shadow-card)" }}
    >
      <a href={`/company/${opportunityScore.id}`} className="block no-underline" style={{ color: "var(--fg)" }}>
        <div className="flex items-center gap-3 p-4 pb-3">
          <CompanyAvatar name={signal.company.name} size={40} />
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold truncate">{signal.company.name}</div>
            <div className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--fg-faint)" }}>
              <UrgencyFlag urgency={opportunityScore.urgency} />
              {formatRelativeDate(signal.detectedAt)}
            </div>
          </div>
          <CategoryBadge category={signal.category} />
        </div>

        {signal.imageUrl && (
          <SignalImage
            src={signal.imageUrl}
            alt=""
            className="w-full object-cover"
            style={{ height: "220px", background: "var(--card-hover)" }}
          />
        )}

        <p className="text-[14.5px] font-semibold leading-[1.45] m-0 px-4 pt-3.5" style={{ textWrap: "balance" }}>
          {headline}
        </p>
      </a>

      <div
        className="flex items-center justify-between gap-3 px-4 py-3 mt-3.5 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <SpinosScore value={opportunityScore.score} variant="compact" />
          <span className="text-[10.5px] font-semibold uppercase" style={{ color: "var(--fg-faint)", letterSpacing: "0.05em" }}>
            Spinos Score
          </span>
        </div>
        <SourceLink sourceUrl={signal.sourceUrl} />
      </div>
    </article>
  );
}

// Sinal bruto da coleta gratuita — ainda não virou Oportunidade pontuada
// (sem score/reasoning/abordagem), então não linka pra uma página interna
// (não existe uma sem OpportunityScore) nem mostra Spinos Score.
function RawFeedCard({ story }: { story: RawStory }) {
  const { signal, company } = story;
  const headline = headlineFor(signal, SIGNAL_CATEGORY_LABEL[signal.category] ?? SIGNAL_CATEGORY_LABEL.OTHER);

  return (
    <article
      className="rounded-[16px] border overflow-hidden"
      style={{ borderColor: "var(--border)", background: "var(--card)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center gap-3 p-4 pb-3">
        <CompanyAvatar name={company.name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold truncate">{company.name}</div>
          <div className="text-[11.5px]" style={{ color: "var(--fg-faint)" }}>
            {formatRelativeDate(signal.detectedAt)}
          </div>
        </div>
        <CategoryBadge category={signal.category} />
      </div>

      <p className="text-[14.5px] font-semibold leading-[1.45] m-0 px-4 pt-1" style={{ textWrap: "balance" }}>
        {headline}
      </p>

      <div
        className="flex items-center justify-between gap-3 px-4 py-3 mt-3.5 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <SourceBadge sourceType={signal.sourceType} />
        <SourceLink sourceUrl={signal.sourceUrl} />
      </div>
    </article>
  );
}
