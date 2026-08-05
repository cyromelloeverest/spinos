export type PlanId = "STARTER" | "PROFISSIONAL" | "ENTERPRISE";

export type PlanDefinition = {
  id: PlanId;
  name: string;
  maxActiveOpportunities: number | null; // null = ilimitado
  maxUsers: number | null;
  maxSearchesPerMonth: number | null;
  features: {
    radar: boolean;
    assistenteVendas: boolean;
    multipleIcps: boolean;
  };
  priceMonthlyBRL: number;
  stripePriceId: string;
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  STARTER: {
    id: "STARTER",
    name: "Starter",
    maxActiveOpportunities: 25,
    maxUsers: 1,
    maxSearchesPerMonth: 4,
    features: { radar: false, assistenteVendas: false, multipleIcps: false },
    priceMonthlyBRL: 309,
    stripePriceId: "price_1U0tTkEqWpT7TrUVXoLERMhz",
  },
  PROFISSIONAL: {
    id: "PROFISSIONAL",
    name: "Profissional",
    maxActiveOpportunities: 100,
    maxUsers: 5,
    maxSearchesPerMonth: 15,
    features: { radar: true, assistenteVendas: true, multipleIcps: false },
    priceMonthlyBRL: 649,
    stripePriceId: "price_1U0tTkEqWpT7TrUViSAfShM7",
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Enterprise",
    maxActiveOpportunities: null,
    maxUsers: null,
    maxSearchesPerMonth: null,
    features: { radar: true, assistenteVendas: true, multipleIcps: true },
    priceMonthlyBRL: 1699,
    stripePriceId: "price_1U0tTlEqWpT7TrUVvmsqhzaU",
  },
};

export function getPlan(planId: string): PlanDefinition {
  return PLANS[planId as PlanId] ?? PLANS.STARTER;
}

export function getPlanByStripePriceId(stripePriceId: string): PlanDefinition | null {
  return Object.values(PLANS).find((p) => p.stripePriceId === stripePriceId) ?? null;
}
