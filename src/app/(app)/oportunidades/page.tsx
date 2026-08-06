import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganizationId, getCurrentMembership } from "@/lib/auth/current-org";
import { runSearchAction } from "@/lib/actions/search";
import { SEARCH_COOLDOWN_MS, startOfCurrentMonth } from "@/lib/opportunity-engine/constants";
import { moveToPipeline, dismissOpportunity } from "@/lib/actions/pipeline";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { SearchButton } from "@/components/SearchButton";
import { SpinosScore } from "@/components/SpinosScore";
import { ArrowRight, X, Check, Flame, TrendingUp, Minus, Target, Download } from "lucide-react";
import { SIGNAL_CATEGORY_LABEL } from "@/lib/signal-categories";
import { getPlan } from "@/lib/plans";

const URGENCY_CONFIG: Record<string, { label: string; icon: typeof Flame; color: string }> = {
  ALTA: { label: "Alta", icon: Flame, color: "var(--primary)" },
  MEDIA: { label: "Média", icon: TrendingUp, color: "var(--fg-muted)" },
  BAIXA: { label: "Baixa", icon: Minus, color: "var(--fg-faint)" },
};

function fetchOpportunities(organizationId: string) {
  return prisma.opportunityScore.findMany({
    where: { organizationId, stage: null, status: { not: "DISMISSED" } },
    include: { company: true, signalsUsed: { include: { signal: true } } },
    orderBy: { score: "desc" },
  });
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function isInFuture(date: Date): boolean {
  return date.getTime() > Date.now();
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; count?: string; message?: string; nextAt?: string; limit?: string }>;
}) {
  const params = await searchParams;
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    redirect("/onboarding");
  }

  let opportunities: Awaited<ReturnType<typeof fetchOpportunities>> = [];
  let organization: Awaited<ReturnType<typeof prisma.organization.findUnique>> = null;
  let searchesThisMonth = 0;
  let latestMission: Awaited<ReturnType<typeof prisma.mission.findFirst>> = null;
  let dbError = false;
  try {
    [opportunities, organization, searchesThisMonth, latestMission] = await Promise.all([
      fetchOpportunities(organizationId),
      prisma.organization.findUnique({ where: { id: organizationId } }),
      prisma.searchRun.count({ where: { organizationId, createdAt: { gte: startOfCurrentMonth() } } }),
      prisma.mission.findFirst({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
    ]);
  } catch {
    dbError = true;
  }

  if (dbError) return <DbSetupNotice />;

  const membership = await getCurrentMembership();
  const anthropicConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
  const lastSearchAt = organization?.lastSearchAt ?? null;
  const nextAvailableAt = lastSearchAt ? new Date(lastSearchAt.getTime() + SEARCH_COOLDOWN_MS) : null;
  const onCooldown = Boolean(nextAvailableAt && isInFuture(nextAvailableAt));
  const plan = getPlan(organization?.plan ?? "STARTER");
  const atPlanLimit = plan.maxActiveOpportunities !== null && opportunities.length >= plan.maxActiveOpportunities;
  const atSearchLimit = plan.maxSearchesPerMonth !== null && searchesThisMonth >= plan.maxSearchesPerMonth;
  const remainingSearches =
    plan.maxSearchesPerMonth !== null ? Math.max(plan.maxSearchesPerMonth - searchesThisMonth - 1, 0) : null;
  const userBlocked = Boolean(membership?.searchBlocked);
  const searchDisabled = !anthropicConfigured || onCooldown || atPlanLimit || atSearchLimit || userBlocked;
  const disabledTitle = !anthropicConfigured
    ? "Configure ANTHROPIC_API_KEY no .env para ativar"
    : userBlocked
      ? "Sua conta está temporariamente impedida de fazer buscas"
      : atPlanLimit
        ? `Limite de ${plan.maxActiveOpportunities} oportunidades ativas do plano ${plan.name} atingido`
        : atSearchLimit
          ? `Limite de ${plan.maxSearchesPerMonth} buscas/mês do plano ${plan.name} atingido`
          : onCooldown && nextAvailableAt
            ? `Próxima busca disponível em ${formatDateTime(nextAvailableAt)}`
            : undefined;

  return (
    <div>
      <div
        className="mx-4 md:mx-10 mt-6 rounded-[16px] border p-6 flex items-center justify-between gap-6 flex-wrap"
        style={{ background: "var(--card)", borderColor: "var(--primary-line)", boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="w-12 h-12 rounded-[12px] flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
          >
            <Target size={22} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            {latestMission && (
              <div className="text-[11px] uppercase font-semibold mb-1" style={{ color: "var(--primary)", letterSpacing: "0.06em" }}>
                Missão de {latestMission.createdAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
              </div>
            )}
            <h1 className="text-[20px] font-bold m-0 mb-0.5" style={{ textWrap: "balance" }}>
              Empresas que você deveria abordar esta semana
            </h1>
            <p className="m-0 text-[13px]" style={{ color: "var(--fg-muted)" }}>
              {opportunities.length === 0
                ? "Nenhuma oportunidade ainda — rode uma busca pra encontrar sinais reais pro seu ICP."
                : `${opportunities.length} oportunidades calculadas a partir do seu ICP.`}
              {plan.maxActiveOpportunities !== null && (
                <span style={{ color: atPlanLimit ? "var(--warn)" : "var(--fg-faint)" }}>
                  {" "}
                  ({opportunities.length}/{plan.maxActiveOpportunities} do plano {plan.name})
                </span>
              )}
              {plan.maxSearchesPerMonth !== null && (
                <span style={{ color: atSearchLimit ? "var(--warn)" : "var(--fg-faint)" }}>
                  {" "}
                  · {searchesThisMonth}/{plan.maxSearchesPerMonth} buscas este mês
                </span>
              )}
            </p>
          </div>
        </div>
        <form action={runSearchAction} className="flex-shrink-0 w-full sm:w-auto">
          <SearchButton disabled={searchDisabled} disabledTitle={disabledTitle} remainingSearches={remainingSearches} />
        </form>
      </div>

      <div className="px-4 md:px-10 pt-4 flex justify-end">
        {plan.features.crmExport ? (
          <a
            href="/export"
            className="flex items-center gap-1.5 text-[12px] font-medium no-underline"
            style={{ color: "var(--fg-faint)" }}
          >
            <Download size={13} strokeWidth={1.75} />
            Exportar CSV
          </a>
        ) : (
          <span
            title="Disponível a partir do plano Profissional"
            className="flex items-center gap-1.5 text-[12px] font-medium cursor-not-allowed"
            style={{ color: "var(--fg-faint)", opacity: 0.5 }}
          >
            <Download size={13} strokeWidth={1.75} />
            Exportar CSV
          </span>
        )}
      </div>

      {params.search === "not_configured" && (
        <div className="mx-4 md:mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
          Configure a chave ANTHROPIC_API_KEY no arquivo .env para ativar a busca automática.
        </div>
      )}
      {params.search === "rate_limited" && (
        <div className="mx-4 md:mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
          Já rodamos uma busca recentemente (limite de 1 a cada 2 dias, pra não gastar à toa). Próxima disponível em{" "}
          {params.nextAt ? formatDateTime(new Date(params.nextAt)) : "breve"}.
        </div>
      )}
      {params.search === "plan_limit" && (
        <div className="mx-4 md:mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
          Seu plano permite até {params.limit ?? plan.maxActiveOpportunities} oportunidades ativas simultâneas. Mova ou descarte oportunidades no pipeline para liberar espaço, ou fale com a gente para evoluir de plano.
        </div>
      )}
      {params.search === "search_limit" && (
        <div className="mx-4 md:mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
          Seu plano permite até {params.limit ?? plan.maxSearchesPerMonth} buscas por mês, e o limite já foi atingido. O contador reseta no início do próximo mês, ou fale com a gente para evoluir de plano.
        </div>
      )}
      {params.search === "user_blocked" && (
        <div className="mx-4 md:mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
          Sua conta está temporariamente impedida de fazer buscas. Fale com o administrador da sua empresa.
        </div>
      )}
      {params.search === "error" && (
        <div className="mx-4 md:mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--critical)", color: "var(--critical)" }}>
          {params.message ?? "Erro ao buscar oportunidades."}
        </div>
      )}
      {params.search === "ok" && (
        <div className="mx-4 md:mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--primary)", color: "var(--primary)" }}>
          {params.count} oportunidade(s) encontrada(s) e adicionada(s).
        </div>
      )}

      <div className="px-4 md:px-10 pt-6 pb-16 flex flex-col gap-2.5 max-w-[880px]">
        {opportunities.map((opp) => {
          const urgency = URGENCY_CONFIG[opp.urgency] ?? URGENCY_CONFIG.BAIXA;
          const UrgencyIcon = urgency.icon;
          const isNew = Boolean(lastSearchAt && opp.computedAt.getTime() === lastSearchAt.getTime());
          return (
            <div
              key={opp.id}
              className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 rounded-[16px] border p-4 sm:p-5"
              style={{
                background: "var(--card)",
                borderColor: "var(--border)",
                color: "var(--fg)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <Link href={`/company/${opp.id}`} className="flex items-center gap-5 flex-1 min-w-0 no-underline" style={{ color: "var(--fg)" }}>
                <SpinosScore value={opp.score} variant="card" />

                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className="text-[15.5px] font-semibold">{opp.company.name}</div>
                    <div className="text-[12px]" style={{ color: "var(--fg-faint)" }}>
                      {opp.company.city}, {opp.company.state}
                    </div>
                  </div>
                  <div className="text-[13px] mb-2.5 leading-[1.5]" style={{ color: "var(--fg-muted)" }}>
                    {opp.headline}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {opp.signalsUsed.slice(0, 4).map(({ signal }) => (
                      <div
                        key={signal.id}
                        className="text-[11.5px] rounded-[8px] border px-2 py-[3px] flex items-center gap-1 whitespace-nowrap"
                        style={{ color: "var(--fg-muted)", borderColor: "var(--border)" }}
                      >
                        <Check size={11} strokeWidth={2.25} style={{ color: "var(--primary)" }} />
                        {SIGNAL_CATEGORY_LABEL[signal.category] ?? signal.title}
                      </div>
                    ))}
                  </div>
                </div>
              </Link>

              <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 sm:flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  {isNew && (
                    <div
                      className="text-[10px] font-semibold rounded-full px-2 py-1"
                      style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                    >
                      NOVO
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-[11.5px] font-medium" style={{ color: urgency.color }}>
                    <UrgencyIcon size={13} strokeWidth={2} />
                    {urgency.label}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <form action={moveToPipeline.bind(null, opp.id)}>
                    <button
                      type="submit"
                      title="Mover para o pipeline"
                      aria-label="Mover para o pipeline"
                      className="flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-1 border cursor-pointer"
                      style={{ background: "var(--primary-soft)", color: "var(--primary)", borderColor: "transparent" }}
                    >
                      Pipeline
                      <ArrowRight size={12} strokeWidth={2} />
                    </button>
                  </form>
                  <form action={dismissOpportunity.bind(null, opp.id)}>
                    <button
                      type="submit"
                      title="Descartar"
                      aria-label="Descartar"
                      className="rounded-full w-[26px] h-[26px] border cursor-pointer flex items-center justify-center"
                      style={{ color: "var(--fg-faint)", borderColor: "var(--border)" }}
                    >
                      <X size={13} strokeWidth={1.75} />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
