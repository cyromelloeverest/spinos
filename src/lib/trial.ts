import { getPlan } from "@/lib/plans";

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
  isTrialing: boolean;
} {
  if (organization.trialEndsAt !== null) {
    return { maxActiveOpportunities: TRIAL_MAX_ACTIVE_OPPORTUNITIES, maxSearches: TRIAL_MAX_SEARCHES, isTrialing: true };
  }
  const plan = getPlan(organization.plan);
  return { maxActiveOpportunities: plan.maxActiveOpportunities, maxSearches: plan.maxSearchesPerMonth, isTrialing: false };
}
