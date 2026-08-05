import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { EmptyState } from "@/components/EmptyState";
import { SignalImage } from "@/components/SignalImage";
import { faviconUrl } from "@/lib/favicon";
import { SIGNAL_CATEGORY_LABEL, SIGNAL_CATEGORY_ICON } from "@/lib/signal-categories";
import { ExternalLink, Flame } from "lucide-react";
import { initials } from "@/lib/initials";

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
      <div className="pt-6 px-4 md:px-10">
        <h1 className="text-[25px] font-medium m-0 mb-1" style={{ fontFamily: "var(--font-display)" }}>
          Radar
        </h1>
        <p className="m-0 text-[13.5px] max-w-[60ch]" style={{ color: "var(--fg-muted)" }}>
          Todos os sinais e novidades encontrados sobre as empresas que você está de olho, em ordem cronológica.
        </p>
      </div>

      <div className="px-4 md:px-10 pt-6 pb-16 max-w-[1080px]">
        {stories.length === 0 && (
          <EmptyState message="Nenhuma notícia ainda — rode uma busca de oportunidades pra começar a coletar sinais." />
        )}

        {hero && <HeroCard link={hero} />}

        {rest.length > 0 && (
          <div className="grid gap-4 mt-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
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

function HeroCard({ link }: { link: StoryLink }) {
  const { signal, opportunityScore } = link;
  const favicon = signal.sourceUrl ? faviconUrl(signal.sourceUrl) : null;
  const headline = headlineFor(signal, SIGNAL_CATEGORY_LABEL[signal.category] ?? SIGNAL_CATEGORY_LABEL.OTHER);

  return (
    <a
      href={`/company/${opportunityScore.id}`}
      className="block rounded-[16px] border overflow-hidden no-underline"
      style={{ borderColor: "var(--primary-line)", background: "var(--card)", color: "var(--fg)", boxShadow: "var(--shadow-card)" }}
    >
      {signal.imageUrl && (
        <SignalImage
          src={signal.imageUrl}
          alt=""
          className="w-full object-cover"
          style={{ height: "260px", background: "var(--card-hover)" }}
        />
      )}
      <div className="p-6 md:p-7">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <CompanyAvatar name={signal.company.name} size={44} />
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold truncate">{signal.company.name}</div>
            <div className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--fg-faint)" }}>
              <UrgencyFlag urgency={opportunityScore.urgency} />
              {formatRelativeDate(signal.detectedAt)}
            </div>
          </div>
          <div className="ml-auto">
            <CategoryBadge category={signal.category} />
          </div>
        </div>
        <div className="text-[22px] font-bold leading-[1.3] mb-3" style={{ textWrap: "balance" }}>
          {headline}
        </div>
        {signal.sourceUrl && (
          <span className="text-[12px] inline-flex items-center gap-1.5 font-medium" style={{ color: "var(--primary)" }}>
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
  const headline = headlineFor(signal, SIGNAL_CATEGORY_LABEL[signal.category] ?? SIGNAL_CATEGORY_LABEL.OTHER);
  const trimmedHeadline = headline.length > 150 ? headline.slice(0, 150) + "…" : headline;
  const favicon = signal.sourceUrl ? faviconUrl(signal.sourceUrl) : null;

  return (
    <a
      href={`/company/${opportunityScore.id}`}
      className="rounded-[16px] border overflow-hidden flex flex-col no-underline"
      style={{ borderColor: "var(--border)", color: "var(--fg)", background: "var(--card)", boxShadow: "var(--shadow-card)" }}
    >
      {signal.imageUrl && (
        <SignalImage
          src={signal.imageUrl}
          alt=""
          className="w-full object-cover flex-shrink-0"
          style={{ height: "130px", background: "var(--card-hover)" }}
        />
      )}
      <div className="p-4.5 flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between gap-2">
          <CategoryBadge category={signal.category} />
          <span className="flex items-center gap-1.5 text-[11px] flex-shrink-0" style={{ color: "var(--fg-faint)" }}>
            <UrgencyFlag urgency={opportunityScore.urgency} />
            {formatRelativeDate(signal.detectedAt)}
          </span>
        </div>
        <p className="text-[13.5px] font-semibold leading-[1.45] m-0 flex-1">{trimmedHeadline}</p>
        <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--fg-faint)" }}>
          <span className="truncate">{signal.company.name}</span>
          {favicon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={favicon} alt="" width={13} height={13} className="rounded-[3px] flex-shrink-0" />
          )}
        </div>
      </div>
    </a>
  );
}
