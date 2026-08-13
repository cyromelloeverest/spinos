export type PlanId = "STARTER" | "PROFISSIONAL" | "ENTERPRISE";

export type AlertsFrequency = "weekly" | "daily" | "realtime";

export type PlanDefinition = {
  id: PlanId;
  name: string;
  maxActiveOpportunities: number | null; // null = ilimitado
  maxUsers: number | null;
  maxSearchesPerMonth: number | null;
  // Ainda não tem UI pra criar mais de 1 ICP por org — isso é a fonte da
  // verdade do limite comercial, mas nada no código impede hoje um usuário
  // de passar dele (não há como criar um segundo ICP de jeito nenhum ainda).
  maxIcps: number | null;
  // Idem: não existe sistema de alertas construído — isso é só o dado
  // comercial, pra quando a feature existir.
  alertsFrequency: AlertsFrequency;
  // Texto descritivo, não é enforced em lugar nenhum (não há sistema de
  // tickets/suporte no produto).
  supportTier: string;
  features: {
    // Enforced de verdade em /export (src/app/(app)/export/route.ts).
    crmExport: boolean;
    // Ainda não é enforced — "/inteligencia-competitiva" é só uma página
    // "em breve" sem nenhum backend real por trás.
    inteligenciaCompetitiva: boolean;
  };
  priceMonthlyBRL: number;
  stripePriceId: string;
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  STARTER: {
    id: "STARTER",
    name: "Starter",
    maxActiveOpportunities: 80,
    maxUsers: 1,
    maxSearchesPerMonth: 15,
    maxIcps: 1,
    alertsFrequency: "weekly",
    supportTier: "Padrão",
    features: { crmExport: false, inteligenciaCompetitiva: false },
    priceMonthlyBRL: 309,
    stripePriceId: "price_1U3mz9EqWpT7TrUVKCOoNqE4",
  },
  PROFISSIONAL: {
    id: "PROFISSIONAL",
    name: "Profissional",
    maxActiveOpportunities: 150,
    maxUsers: 5,
    maxSearchesPerMonth: 25,
    maxIcps: 3,
    alertsFrequency: "daily",
    supportTier: "Prioritário",
    features: { crmExport: true, inteligenciaCompetitiva: false },
    priceMonthlyBRL: 649,
    stripePriceId: "price_1U3mzAEqWpT7TrUVKTqZGbiO",
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Enterprise",
    maxActiveOpportunities: null,
    maxUsers: null,
    maxSearchesPerMonth: null,
    maxIcps: null,
    alertsFrequency: "realtime",
    supportTier: "Onboarding + CS dedicado + SLA",
    features: { crmExport: true, inteligenciaCompetitiva: true },
    priceMonthlyBRL: 1699,
    stripePriceId: "price_1U3mzAEqWpT7TrUVo5lX85N1",
  },
};

export function getPlan(planId: string): PlanDefinition {
  return PLANS[planId as PlanId] ?? PLANS.STARTER;
}

export function getPlanByStripePriceId(stripePriceId: string): PlanDefinition | null {
  return Object.values(PLANS).find((p) => p.stripePriceId === stripePriceId) ?? null;
}
