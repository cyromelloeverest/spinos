import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { faviconUrl } from "@/lib/favicon";
import { ExternalLink } from "lucide-react";

const CATEGORY_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  HIRING: { label: "Contratação", bg: "rgba(91,141,217,0.14)", color: "#5b8dd9" },
  EXPANSION: { label: "Expansão", bg: "var(--primary-soft)", color: "var(--primary)" },
  FUNDING: { label: "Investimento", bg: "var(--warn-soft)", color: "var(--warn)" },
  TECHNOLOGY: { label: "Tecnologia", bg: "rgba(79,184,166,0.14)", color: "#4fb8a6" },
  MARKETING: { label: "Marketing", bg: "rgba(199,107,158,0.14)", color: "#c76b9e" },
  LEADERSHIP_CHANGE: { label: "Mudança de liderança", bg: "rgba(155,127,212,0.14)", color: "#9b7fd4" },
  PROCUREMENT: { label: "Compras", bg: "var(--good-soft)", color: "var(--good)" },
  REGULATORY: { label: "Regulatório", bg: "var(--critical-soft)", color: "var(--critical)" },
  PARTNERSHIP: { label: "Parceria", bg: "rgba(91,141,217,0.14)", color: "#5b8dd9" },
  AWARD: { label: "Prêmio", bg: "var(--warn-soft)", color: "var(--warn)" },
  EVENT: { label: "Evento", bg: "rgba(79,184,166,0.14)", color: "#4fb8a6" },
  ICP_MATCH: { label: "Match com seu ICP", bg: "var(--primary-soft)", color: "var(--primary)" },
  OTHER: { label: "Novidade", bg: "var(--card-hover)", color: "var(--fg-muted)" },
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter((w) => w.length > 1)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(date: Date): string {
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
  return prisma.opportunityScoreSignal.findMany({
    where: { opportunityScore: { organizationId, status: { not: "DISMISSED" } } },
    include: {
      signal: { include: { company: true } },
      opportunityScore: { select: { id: true, urgency: true } },
    },
    orderBy: { signal: { detectedAt: "desc" } },
  });
}

export default async function NewsPage() {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  let links: Awaited<ReturnType<typeof fetchStories>> = [];
  let dbError = false;
  try {
    links = await fetchStories(organizationId);
  } catch {
    dbError = true;
  }
  if (dbError) return <DbSetupNotice />;

  const seen = new Set<string>();
  const stories = links.filter((l) => {
    if (seen.has(l.signal.id)) return false;
    seen.add(l.signal.id);
    return true;
  });

  const [hero, ...rest] = stories;

  return (
    <div>
      <div className="pt-6 px-10">
        <h1 className="text-[25px] font-medium m-0 mb-1" style={{ fontFamily: "var(--font-display)" }}>
          Radar
        </h1>
        <p className="m-0 text-[13.5px] max-w-[60ch]" style={{ color: "var(--fg-muted)" }}>
          Todos os sinais e novidades encontrados sobre as empresas que você está de olho, em ordem cronológica.
        </p>
      </div>

      <div className="px-10 pt-6 pb-16 max-w-[1080px]">
        {stories.length === 0 && (
          <div className="rounded-[10px] border border-dashed p-6 text-[13px] text-center" style={{ borderColor: "var(--border)", color: "var(--fg-faint)" }}>
            Nenhuma notícia ainda — rode uma busca de oportunidades pra começar a coletar sinais.
          </div>
        )}

        {hero && <HeroCard link={hero} />}

        {rest.length > 0 && (
          <div className="grid gap-5 mt-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {rest.map((link) => (
              <StoryCard key={link.id} link={link} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type StoryLink = Awaited<ReturnType<typeof fetchStories>>[number];

function HeroCard({ link }: { link: StoryLink }) {
  const { signal, opportunityScore } = link;
  const cat = CATEGORY_STYLE[signal.category] ?? CATEGORY_STYLE.OTHER;
  const favicon = signal.sourceUrl ? faviconUrl(signal.sourceUrl) : null;
  const headline = headlineFor(signal, cat.label);

  return (
    <a
      href={`/company/${opportunityScore.id}`}
      className="grid gap-0 rounded-[16px] border overflow-hidden no-underline"
      style={{ gridTemplateColumns: "220px 1fr", borderColor: "var(--border)", color: "var(--fg)", boxShadow: "var(--shadow-card)" }}
    >
      <div
        className="flex items-center justify-center relative p-8"
        style={{ background: cat.bg, minHeight: "200px" }}
      >
        <div
          className="text-[42px] font-bold"
          style={{ color: cat.color }}
        >
          {initials(signal.company.name)}
        </div>
      </div>
      <div className="p-6 flex flex-col justify-center" style={{ background: "var(--card)" }}>
        <div
          className="text-[10.5px] font-semibold uppercase self-start rounded-full px-2.5 py-1 mb-3"
          style={{ background: cat.bg, color: cat.color, letterSpacing: "0.05em" }}
        >
          {cat.label}
        </div>
        <div className="text-[11.5px] mb-2" style={{ color: "var(--fg-faint)" }}>
          {signal.company.name} · {formatDate(signal.detectedAt)}
        </div>
        <div className="text-[20px] font-bold leading-[1.3] mb-3" style={{ textWrap: "balance" }}>
          {headline}
        </div>
        {signal.sourceUrl && (
          <span className="text-[12px] inline-flex items-center gap-1.5" style={{ color: "var(--fg-faint)" }}>
            {favicon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={favicon} alt="" width={14} height={14} className="rounded-[3px]" />
            )}
            Ver fonte
            <ExternalLink size={12} strokeWidth={1.75} />
          </span>
        )}
      </div>
    </a>
  );
}

function StoryCard({ link }: { link: StoryLink }) {
  const { signal, opportunityScore } = link;
  const cat = CATEGORY_STYLE[signal.category] ?? CATEGORY_STYLE.OTHER;
  const favicon = signal.sourceUrl ? faviconUrl(signal.sourceUrl) : null;
  const headline = headlineFor(signal, cat.label);
  const trimmedHeadline = headline.length > 150 ? headline.slice(0, 150) + "…" : headline;

  return (
    <a
      href={`/company/${opportunityScore.id}`}
      className="rounded-[16px] border overflow-hidden flex flex-col no-underline"
      style={{ borderColor: "var(--border)", color: "var(--fg)", background: "var(--card)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="h-[6px]" style={{ background: cat.color }} />
      <div className="p-4.5 flex flex-col gap-2 flex-1">
        <div
          className="text-[10px] font-semibold uppercase self-start rounded-full px-2 py-0.5"
          style={{ background: cat.bg, color: cat.color, letterSpacing: "0.05em" }}
        >
          {cat.label}
        </div>
        <p className="text-[13.5px] font-semibold leading-[1.45] m-0 flex-1">{trimmedHeadline}</p>
        <div className="flex items-center justify-between text-[11px] mt-1" style={{ color: "var(--fg-faint)" }}>
          <span>
            {signal.company.name} · {formatDate(signal.detectedAt)}
          </span>
          {favicon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={favicon} alt="" width={14} height={14} className="rounded-[3px] flex-shrink-0" />
          )}
        </div>
      </div>
    </a>
  );
}
