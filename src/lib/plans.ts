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
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  STARTER: {
    id: "STARTER",
    name: "Starter",
    maxActiveOpportunities: 25,
    maxUsers: 1,
    maxSearchesPerMonth: 4,
    features: { radar: false, assistenteVendas: false, multipleIcps: false },
  },
  PROFISSIONAL: {
    id: "PROFISSIONAL",
    name: "Profissional",
    maxActiveOpportunities: 100,
    maxUsers: 5,
    maxSearchesPerMonth: 15,
    features: { radar: true, assistenteVendas: true, multipleIcps: false },
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Enterprise",
    maxActiveOpportunities: null,
    maxUsers: null,
    maxSearchesPerMonth: null,
    features: { radar: true, assistenteVendas: true, multipleIcps: true },
  },
};

export function getPlan(planId: string): PlanDefinition {
  return PLANS[planId as PlanId] ?? PLANS.STARTER;
}
