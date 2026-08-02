import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganizationId } from "@/lib/auth/current-org";
import { runSearchAction } from "@/lib/actions/search";
import { SEARCH_COOLDOWN_MS } from "@/lib/opportunity-engine/constants";
import { moveToPipeline, dismissOpportunity } from "@/lib/actions/pipeline";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { SearchButton } from "@/components/SearchButton";
import { ArrowRight, X, Check, Flame, TrendingUp, Minus, Target, Download } from "lucide-react";
import { SIGNAL_CATEGORY_LABEL } from "@/lib/signal-categories";
import { getPlan } from "@/lib/plans";

const URGENCY_CONFIG: Record<string, { label: string; icon: typeof Flame; color: string }> = {
  ALTA: { label: "Alta", icon: Flame, color: "var(--primary)" },
  MEDIA: { label: "Média", icon: TrendingUp, color: "var(--fg-muted)" },
  BAIXA: { label: "Baixa", icon: Minus, color: "var(--fg-faint)" },
};

function scoreStyle(score: number) {
  if (score >= 85) return { bg: "var(--primary)", color: "#ffffff", border: "var(--primary)" };
  if (score >= 60) return { bg: "var(--primary-soft)", color: "var(--primary)", border: "var(--primary-line)" };
  return { bg: "var(--card-hover)", color: "var(--fg-muted)", border: "var(--border)" };
}

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
  let dbError = false;
  try {
    [opportunities, organization] = await Promise.all([
      fetchOpportunities(organizationId),
      prisma.organization.findUnique({ where: { id: organizationId } }),
    ]);
  } catch {
    dbError = true;
  }

  if (dbError) return <DbSetupNotice />;

  const anthropicConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
  const lastSearchAt = organization?.lastSearchAt ?? null;
  const nextAvailableAt = lastSearchAt ? new Date(lastSearchAt.getTime() + SEARCH_COOLDOWN_MS) : null;
  const onCooldown = Boolean(nextAvailableAt && isInFuture(nextAvailableAt));
  const plan = getPlan(organization?.plan ?? "STARTER");
  const atPlanLimit = plan.maxActiveOpportunities !== null && opportunities.length >= plan.maxActiveOpportunities;
  const searchDisabled = !anthropicConfigured || onCooldown || atPlanLimit;
  const disabledTitle = !anthropicConfigured
    ? "Configure ANTHROPIC_API_KEY no .env para ativar"
    : atPlanLimit
      ? `Limite de ${plan.maxActiveOpportunities} oportunidades ativas do plano ${plan.name} atingido`
      : onCooldown && nextAvailableAt
        ? `Próxima busca disponível em ${formatDateTime(nextAvailableAt)}`
        : undefined;

  return (
    <div>
      <div
        className="mx-4 md:mx-10 mt-6 rounded-[20px] border p-6 flex items-center justify-between gap-6 flex-wrap"
        style={{ background: "var(--card)", borderColor: "var(--primary-line)", boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="w-12 h-12 rounded-[14px] flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
          >
            <Target size={22} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
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
            </p>
          </div>
        </div>
        <form action={runSearchAction} className="flex-shrink-0 w-full sm:w-auto">
          <SearchButton disabled={searchDisabled} disabledTitle={disabledTitle} />
        </form>
      </div>

      <div className="px-4 md:px-10 pt-4 flex justify-end">
        <a
          href="/export"
          className="flex items-center gap-1.5 text-[12px] font-medium no-underline"
          style={{ color: "var(--fg-faint)" }}
        >
          <Download size={13} strokeWidth={1.75} />
          Exportar CSV
        </a>
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
      {params.search === "error" && (
        <div className="mx-4 md:mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--critical)", color: "var(--critical)" }}>
          {params.message ?? "Erro ao buscar oportunidades."}
        </div>
      )}
      {params.search === "ok" && (
        <div className="mx-4 md:mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--good)", color: "var(--good)" }}>
          {params.count} oportunidade(s) encontrada(s) e adicionada(s).
        </div>
      )}

      <div className="px-4 md:px-10 pt-6 pb-16 flex flex-col gap-2.5 max-w-[880px]">
        {opportunities.map((opp) => {
          const urgency = URGENCY_CONFIG[opp.urgency] ?? URGENCY_CONFIG.BAIXA;
          const UrgencyIcon = urgency.icon;
          const sStyle = scoreStyle(opp.score);
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
                <div
                  className="w-16 h-16 rounded-[10px] flex items-center justify-center border font-bold text-[26px] flex-shrink-0"
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    background: sStyle.bg,
                    color: sStyle.color,
                    borderColor: sStyle.border,
                  }}
                >
                  {opp.score}
                </div>

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
                        className="text-[11.5px] rounded-[6px] border px-2 py-[3px] flex items-center gap-1 whitespace-nowrap"
                        style={{ color: "var(--fg-muted)", borderColor: "var(--border)" }}
                      >
                        <Check size={11} strokeWidth={2.25} style={{ color: "var(--good)" }} />
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
                      style={{ background: "var(--good-soft)", color: "var(--good)" }}
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
