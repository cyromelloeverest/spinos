import { getPlan } from "@/lib/plans";
import { SEARCH_COOLDOWN_MS } from "@/lib/opportunity-engine/constants";

export const TRIAL_DAYS = 7;

// Teto fixo do trial, independente do plano escolhido pra testar — sem
// isso, alguém "testando" o Enterprise (buscas ilimitadas) sem cartão de
// crédito drena o saldo da API sem limite nenhum durante os 7 dias.
// Números iniciais, ajustáveis depois de olhar dado real de conversão.
//
// 1 (não mais): a busca sob demanda é a "amostra grátis" — mostra o
// produto completo (score, argumentos, objeções) uma vez, pra converter,
// sem deixar o trial gastar IA à toa depois disso. A coleta gratuita
// (RSS/PNCP, ver src/lib/free-signals/) continua rodando em paralelo sem
// nenhum custo adicional, mesmo depois de esgotada a amostra. Depois da
// 1ª busca, só compra de créditos avulsos (ver CREDIT_PACK)
// libera buscas sob demanda extras dentro do trial.
export const TRIAL_MAX_SEARCHES = 1;
export const TRIAL_MAX_ACTIVE_OPPORTUNITIES = 20;
// Pedidos de conteúdo no trial inteiro (7 dias): o suficiente para sentir o produto sem gastar IA à toa.
export const TRIAL_MAX_CONTENT = 3;

export function newTrialEndsAt(daysFromNow: number = TRIAL_DAYS): Date {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
}

export function isTrialExpired(trialEndsAt: Date | null): boolean {
  return trialEndsAt !== null && trialEndsAt.getTime() < Date.now();
}

export function trialDaysLeft(trialEndsAt: Date | null): number | null {
  if (trialEndsAt === null) return null;
  const msLeft = trialEndsAt.getTime() - Date.now();
  return Math.ceil(msLeft / (24 * 60 * 60 * 1000));
}

// trialEndsAt não-nulo = ainda em trial (uma vez expirado, a camada de
// layout já bloqueia o app inteiro antes de qualquer ação chegar aqui — ver
// src/app/(app)/layout.tsx). Nesse estado, o teto do trial sempre vence o
// limite do plano selecionado, mesmo que a pessoa tenha escolhido "testar"
// o Enterprise. trialEndsAt null = sem teste (conta paga ou uso interno) —
// aí sim vale o limite real do plano. Nenhum dos dois caminhos retorna
// null — nenhum plano (incl. Enterprise) tem dimensão ilimitada.
export function effectiveLimits(organization: { plan: string; trialEndsAt: Date | null }): {
  maxActiveOpportunities: number;
  maxSearches: number;
  /** Contas-alvo novas por mês; null no trial (lá o teto é o de oportunidades ativas e de buscas do teste). */
  maxTargetAccounts: number | null;
  isTrialing: boolean;
} {
  if (organization.trialEndsAt !== null) {
    return { maxActiveOpportunities: TRIAL_MAX_ACTIVE_OPPORTUNITIES, maxSearches: TRIAL_MAX_SEARCHES, maxTargetAccounts: null, isTrialing: true };
  }
  const plan = getPlan(organization.plan);
  return {
    maxActiveOpportunities: plan.maxActiveOpportunities,
    maxSearches: plan.maxSearchesPerMonth,
    maxTargetAccounts: plan.maxTargetAccountsPerMonth,
    isTrialing: false,
  };
}

// Intervalo entre buscas: o trial mantém o intervalo longo (a busca é a amostra grátis); quem paga tem o do plano.
export function effectiveSearchCooldownMs(organization: { plan: string; trialEndsAt: Date | null }): number {
  return organization.trialEndsAt !== null ? SEARCH_COOLDOWN_MS : getPlan(organization.plan).searchCooldownMs;
}

// Teto de pedidos de conteúdo: no trial vale o total do trial (nunca o plano escolhido para testar);
// fora dele, o do plano por mês.
export function effectiveContentLimit(organization: { plan: string; trialEndsAt: Date | null }): { max: number; isTrialing: boolean } {
  if (organization.trialEndsAt !== null) return { max: TRIAL_MAX_CONTENT, isTrialing: true };
  return { max: getPlan(organization.plan).maxContentPerMonth, isTrialing: false };
}
