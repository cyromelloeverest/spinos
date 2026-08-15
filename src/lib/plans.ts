export type PlanId = "STARTER" | "PROFISSIONAL" | "ENTERPRISE";

export type AlertsFrequency = "weekly" | "daily" | "realtime";

export type PlanDefinition = {
  id: PlanId;
  name: string;
  // Nenhum plano tem dimensão ilimitada de propósito (decisão de negócio
  // 2026-08-11): IA, suporte e receita não capturada de conta grande são
  // custo real. O Enterprise é o teto mais alto, não "sem teto" — passar
  // dele não é upgrade de plano automático (não existe plano acima), é
  // conversa comercial. Ver a mensagem específica de Enterprise em
  // team.ts/oportunidades/page.tsx quando o teto é atingido.
  maxActiveOpportunities: number;
  maxUsers: number;
  maxSearchesPerMonth: number;
  // Ainda não tem UI pra criar mais de 1 ICP por org — isso é a fonte da
  // verdade do limite comercial, mas nada no código impede hoje um usuário
  // de passar dele (não há como criar um segundo ICP de jeito nenhum ainda).
  maxIcps: number;
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
    // Igual em todos os planos de propósito: ainda não existe UI pra criar
    // mais de 1 ICP por org (decisão 2026-08-14) — diferenciar por plano
    // venderia algo que nenhum cliente consegue usar hoje.
    maxIcps: 1,
    alertsFrequency: "daily",
    supportTier: "Prioritário",
    features: { crmExport: true, inteligenciaCompetitiva: false },
    priceMonthlyBRL: 649,
    stripePriceId: "price_1U3mzAEqWpT7TrUVKTqZGbiO",
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Enterprise",
    maxActiveOpportunities: 400,
    maxUsers: 20,
    maxSearchesPerMonth: 60,
    maxIcps: 1,
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
