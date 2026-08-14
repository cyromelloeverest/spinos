import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentOrganizationId, getCurrentMembership } from "@/lib/auth/current-org";
import { runSearchAction, runTargetedSearchAction } from "@/lib/actions/search";
import { TargetedSearchForm } from "@/components/TargetedSearchForm";
import { SEARCH_COOLDOWN_MS, startOfCurrentMonth } from "@/lib/opportunity-engine/constants";
import { moveToPipeline, dismissOpportunity } from "@/lib/actions/pipeline";
import { DbSetupNotice } from "@/components/DbSetupNotice";
import { RadarAnimation } from "@/components/RadarAnimation";
import { SearchButton } from "@/components/SearchButton";
import { SpinosScore } from "@/components/SpinosScore";
import { ArrowRight, X, Check, Flame, TrendingUp, Minus, Target, Download, Zap } from "lucide-react";
import { SIGNAL_CATEGORY_LABEL } from "@/lib/signal-categories";
import { getPlan } from "@/lib/plans";
import { effectiveLimits } from "@/lib/trial";
import { purchaseCredits } from "@/lib/actions/credits";
import { CREDIT_PACK } from "@/lib/credit-pack";
import { formatLocation } from "@/lib/format-location";
import { logError } from "@/lib/log-error";

const URGENCY_CONFIG: Record<string, { label: string; icon: typeof Flame; color: string }> = {
  ALTA: { label: "Alta", icon: Flame, color: "var(--primary)" },
  MEDIA: { label: "Média", icon: TrendingUp, color: "var(--fg-muted)" },
  BAIXA: { label: "Baixa", icon: Minus, color: "var(--fg-faint)" },
};

function fetchOpportunities(tx: Prisma.TransactionClient, organizationId: string) {
  return tx.opportunityScore.findMany({
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
  searchParams: Promise<{
    search?: string;
    count?: string;
    message?: string;
    nextAt?: string;
    limit?: string;
    creditos?: string;
    company?: string;
  }>;
}) {
  const params = await searchParams;
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    redirect("/onboarding");
  }

  let opportunities: Awaited<ReturnType<typeof fetchOpportunities>> = [];
  let organization: Prisma.OrganizationModel | null = null;
  let searchesThisMonth = 0;
  let searchesAllTime = 0;
  let latestMission: Prisma.MissionModel | null = null;
  let dbError = false;
  try {
    [opportunities, organization, searchesThisMonth, searchesAllTime, latestMission] = await withOrgContext(
      organizationId,
      (tx) =>
        Promise.all([
          fetchOpportunities(tx, organizationId),
          tx.organization.findUnique({ where: { id: organizationId } }),
          tx.searchRun.count({ where: { organizationId, createdAt: { gte: startOfCurrentMonth() } } }),
          // Usado só se a org estiver em trial (teto é pros 7 dias inteiros,
          // não "por mês") — barato o bastante pra sempre buscar em paralelo
          // em vez de encadear depois de saber se está em trial.
          tx.searchRun.count({ where: { organizationId } }),
          tx.mission.findFirst({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
        ]),
    );
  } catch (err) {
    logError("oportunidades: falha ao carregar oportunidades", err, { organizationId });
    dbError = true;
  }

  if (dbError) return <DbSetupNotice />;

  const membership = await getCurrentMembership();
  const anthropicConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
  const lastSearchAt = organization?.lastSearchAt ?? null;
  const nextAvailableAt = lastSearchAt ? new Date(lastSearchAt.getTime() + SEARCH_COOLDOWN_MS) : null;
  const onCooldown = Boolean(nextAvailableAt && isInFuture(nextAvailableAt));
  const plan = getPlan(organization?.plan ?? "STARTER");
  const { maxActiveOpportunities, maxSearches, isTrialing } = effectiveLimits(
    organization ?? { plan: "STARTER", trialEndsAt: null },
  );
  const searchesUsed = isTrialing ? searchesAllTime : searchesThisMonth;
  const atPlanLimit = opportunities.length >= maxActiveOpportunities;
  const creditBalance = organization?.creditBalance ?? 0;
  // Enterprise pago (fora de trial) não compra saldo — acima do teto
  // incluso é conversa comercial, não compra automática (decisão de
  // negócio 2026-08-11, mantém o tom de atendimento dedicado desse plano).
  // Trial sempre pode comprar, mesmo "testando" o Enterprise — o teto ali
  // é sempre o do trial, nunca o do plano selecionado (ver trial.ts).
  const isPaidEnterprise = !isTrialing && plan.id === "ENTERPRISE";
  const showCreditPurchase = !isPaidEnterprise;
  const rawAtSearchLimit = searchesUsed >= maxSearches;
  const atSearchLimit = rawAtSearchLimit && (isPaidEnterprise || creditBalance <= 0);
  const remainingSearches = Math.max(maxSearches - searchesUsed - 1, 0);
  const userBlocked = Boolean(membership?.searchBlocked);
  const searchDisabled = !anthropicConfigured || onCooldown || atPlanLimit || atSearchLimit || userBlocked;
  const disabledTitle = !anthropicConfigured
    ? "Configure ANTHROPIC_API_KEY no .env para ativar"
    : userBlocked
      ? "Sua conta está temporariamente impedida de fazer buscas"
      : atPlanLimit
        ? isTrialing
          ? `Limite de ${maxActiveOpportunities} oportunidades ativas do teste grátis atingido`
          : isPaidEnterprise
            ? `Limite de ${maxActiveOpportunities} oportunidades ativas do plano Enterprise atingido — fale com o time comercial`
            : `Limite de ${maxActiveOpportunities} oportunidades ativas do plano ${plan.name} atingido`
        : atSearchLimit
          ? isTrialing
            ? `Limite de ${maxSearches} buscas do teste grátis atingido`
            : isPaidEnterprise
              ? `Limite de ${maxSearches} buscas/mês do plano Enterprise atingido — fale com o time comercial`
              : `Limite de ${maxSearches} buscas/mês do plano ${plan.name} atingido`
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
              <span style={{ color: atPlanLimit ? "var(--warn)" : "var(--fg-faint)" }}>
                {" "}
                ({opportunities.length}/{maxActiveOpportunities}{isTrialing ? " do teste grátis" : ` do plano ${plan.name}`})
              </span>
              <span style={{ color: atSearchLimit ? "var(--warn)" : "var(--fg-faint)" }}>
                {" "}
                · {searchesUsed}/{maxSearches} {isTrialing ? "buscas do teste grátis" : "buscas este mês"}
              </span>
              {creditBalance > 0 && (
                <span style={{ color: creditBalance === 1 ? "var(--warn)" : "var(--fg-faint)" }}>
                  {" "}
                  · +{creditBalance} busca{creditBalance === 1 ? "" : "s"} extra{creditBalance === 1 ? "" : "s"}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-2 flex-shrink-0 w-full sm:w-auto">
          <form action={runSearchAction} className="w-full sm:w-auto">
            <SearchButton
              disabled={searchDisabled}
              disabledTitle={disabledTitle}
              remainingSearches={remainingSearches}
              isTrialing={isTrialing}
            />
          </form>
          {showCreditPurchase && (
            <form action={purchaseCredits}>
              <button
                type="submit"
                className="flex items-center gap-1.5 text-[11.5px] font-medium mx-auto sm:mx-0 border-0 bg-transparent cursor-pointer"
                style={{ color: "var(--fg-faint)" }}
              >
                <Zap size={11} strokeWidth={1.75} />
                Comprar {CREDIT_PACK.quantity} buscas extras — R${CREDIT_PACK.priceBRL}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="mx-4 md:mx-10 mt-4">
        <form action={runTargetedSearchAction}>
          <TargetedSearchForm disabled={searchDisabled} disabledTitle={disabledTitle} />
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
          {isTrialing
            ? `Seu teste grátis permite até ${params.limit ?? maxActiveOpportunities} oportunidades ativas simultâneas. Mova ou descarte oportunidades no pipeline para liberar espaço, ou assine um plano pago pra continuar sem esse teto.`
            : isPaidEnterprise
              ? `Seu plano Enterprise permite até ${params.limit ?? maxActiveOpportunities} oportunidades ativas simultâneas. Mova ou descarte oportunidades no pipeline para liberar espaço, ou fale com nosso time comercial pra ajustar seu limite.`
              : `Seu plano permite até ${params.limit ?? maxActiveOpportunities} oportunidades ativas simultâneas. Mova ou descarte oportunidades no pipeline para liberar espaço, ou compre buscas extras/evolua de plano abaixo.`}
        </div>
      )}
      {params.search === "search_limit" && (
        <div className="mx-4 md:mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
          {isTrialing
            ? `Seu teste grátis permite até ${params.limit ?? maxSearches} buscas nos 7 dias, e o limite já foi atingido. Assine um plano pago ou compre buscas extras abaixo pra continuar buscando.`
            : isPaidEnterprise
              ? `Seu plano Enterprise permite até ${params.limit ?? maxSearches} buscas por mês, e o limite já foi atingido. O contador reseta no início do próximo mês, ou fale com nosso time comercial pra ajustar seu limite.`
              : `Seu plano permite até ${params.limit ?? maxSearches} buscas por mês, e o limite já foi atingido. O contador reseta no início do próximo mês, ou compre buscas extras abaixo pra continuar agora.`}
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
      {params.search === "empty" && (
        <div className="mx-4 md:mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
          Não encontramos nenhuma oportunidade real com esse ICP dessa vez — isso não contou na sua cota de buscas.
          Tente ampliar o raio de atuação, adicionar mais segmentos, ou detalhar melhor a descrição do cliente ideal em{" "}
          <Link href="/settings/icp" style={{ color: "var(--warn)", textDecoration: "underline" }}>
            Meu ICP
          </Link>
          . Nova tentativa liberada em poucas horas, não em 2 dias.
        </div>
      )}
      {params.search === "ok" && (
        <div className="mx-4 md:mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--primary)", color: "var(--primary)" }}>
          {params.count} oportunidade(s) encontrada(s) e adicionada(s).
        </div>
      )}
      {params.search === "targeted_ok" && (
        <div className="mx-4 md:mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--primary)", color: "var(--primary)" }}>
          Oportunidade de <strong>{params.company}</strong> encontrada e adicionada à sua lista.
        </div>
      )}
      {params.search === "targeted_empty" && (
        <div className="mx-4 md:mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
          Não conseguimos confirmar publicamente a empresa <strong>{params.company}</strong> — confira o nome (e a
          cidade, se souber) e tente de novo. Isso não contou na sua cota de buscas.
        </div>
      )}
      {params.creditos === "sucesso" && (
        <div className="mx-4 md:mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--primary)", color: "var(--primary)" }}>
          Compra confirmada! O saldo pode levar alguns segundos pra aparecer.
        </div>
      )}
      {params.creditos === "cancelado" && (
        <div className="mx-4 md:mx-10 mt-4 rounded-[8px] border px-4 py-3 text-[12.5px]" style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}>
          Compra cancelada — nenhum valor foi cobrado.
        </div>
      )}

      <div className="px-4 md:px-10 pt-6 pb-16 flex flex-col gap-2.5 max-w-[880px]">
        {opportunities.length === 0 && (
          <div className="flex flex-col items-center text-center py-10">
            <RadarAnimation size={220} />
            <h2 className="text-[16px] font-semibold mt-6 mb-1.5">Nenhuma oportunidade ainda</h2>
            <p className="text-[13px] max-w-[360px]" style={{ color: "var(--fg-muted)" }}>
              Rode uma busca acima pra vasculhar sinais públicos reais e encontrar empresas prontas pra comprar de
              você agora.
            </p>
          </div>
        )}
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
                      {formatLocation(opp.company.city, opp.company.state)}
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
