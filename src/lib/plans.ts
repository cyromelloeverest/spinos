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
  // Pedidos de conteúdo por mês (ideias, posts, artigos, e-mails): cada pedido é um uso, mesmo que
  // gere várias linhas (ex.: 5 ideias). Passou do teto, consome o saldo pré-pago (1 crédito por pedido).
  maxContentPerMonth: number;
  // E-mails de campanha por mês (destinatários enviados). No trial não há campanha: só teste para si.
  maxEmailsPerMonth: number;
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
  /**
   * Contas-alvo novas por mês: o que a oferta comercial promete (100/300/1.000). Cada busca traz de 3 a 6
   * contas, então o teto de buscas por mês é só uma trava técnica acima disso; o limite que vale é este.
   */
  maxTargetAccountsPerMonth: number;
  /** Intervalo mínimo entre duas buscas pagas (o trial mantém SEARCH_COOLDOWN_MS). */
  searchCooldownMs: number;
  priceMonthlyBRL: number;
  /** Plano comercial: gestão de anúncios etc. têm verba de mídia paga direto pelo cliente, fora da mensalidade. */
  mediaBudgetExtra: boolean;
  recommended: boolean;
  /** Frase de apoio da oferta (o que muda em relação ao plano abaixo). */
  tagline: string;
  /** Itens da oferta como aparecem para o cliente (texto comercial, não é enforced linha a linha). */
  highlights: string[];
  stripePriceId: string;
  /** Prices antigos do Stripe que ainda apontam para este plano (assinaturas feitas antes da mudança de preço). */
  legacyStripePriceIds: string[];
};

/** Implantação: pagamento único na contratação. */
export const SETUP_FEE_BRL = 1500;
/** Price único da implantação no Stripe (modo teste; refazer no live com scripts/stripe-setup-plans.mts). */
export const SETUP_FEE_STRIPE_PRICE_ID = "price_1UcRTVEqWpT7TrUVNaQr1pAR";
/** Fidelidade mínima das assinaturas, em meses (cláusula contratual, não é imposta pelo Stripe). */
export const MIN_COMMITMENT_MONTHS = 6;
export const PLANS_FOOTNOTE = `Implantação de R$ ${SETUP_FEE_BRL.toLocaleString("pt-BR")}, pagamento único. Fidelidade mínima de ${MIN_COMMITMENT_MONTHS} meses. Verba de mídia paga diretamente pelo escritório. Gestão de anúncios e conteúdo também podem ser contratados à parte.`;

const HOUR = 60 * 60 * 1000;

export const PLANS: Record<PlanId, PlanDefinition> = {
  STARTER: {
    id: "STARTER",
    name: "Essencial",
    maxActiveOpportunities: 200,
    maxUsers: 2,
    maxSearchesPerMonth: 45,
    maxContentPerMonth: 10,
    maxEmailsPerMonth: 500,
    maxIcps: 1,
    alertsFrequency: "weekly",
    supportTier: "Padrão",
    features: { crmExport: false, inteligenciaCompetitiva: false },
    maxTargetAccountsPerMonth: 100,
    searchCooldownMs: 12 * HOUR,
    priceMonthlyBRL: 997,
    mediaBudgetExtra: false,
    recommended: false,
    tagline: "Para começar",
    highlights: ["100 contas-alvo por mês", "CRM com funil comercial do seu setor", "1 landing page", "Relatório mensal", "2 usuários"],
    stripePriceId: "price_1UcRTSEqWpT7TrUVOS7ba253",
    legacyStripePriceIds: ["price_1U3mz9EqWpT7TrUVKCOoNqE4"],
  },
  PROFISSIONAL: {
    id: "PROFISSIONAL",
    name: "Crescimento",
    maxActiveOpportunities: 600,
    maxUsers: 5,
    maxSearchesPerMonth: 120,
    maxContentPerMonth: 30,
    maxEmailsPerMonth: 2500,
    // Igual em todos os planos de propósito: ainda não existe UI pra criar
    // mais de 1 ICP por org (decisão 2026-08-14) — diferenciar por plano
    // venderia algo que nenhum cliente consegue usar hoje.
    maxIcps: 1,
    alertsFrequency: "daily",
    supportTier: "Prioritário",
    features: { crmExport: true, inteligenciaCompetitiva: false },
    maxTargetAccountsPerMonth: 300,
    searchCooldownMs: 6 * HOUR,
    priceMonthlyBRL: 1997,
    mediaBudgetExtra: false,
    recommended: true,
    tagline: "Com o time Everest",
    highlights: [
      "300 contas-alvo por mês",
      "Follow-up automático no CRM",
      "Landing pages por serviço",
      "Perfil da Empresa no Google",
      "E-mails prontos todo mês",
      "Reunião mensal e 5 usuários",
    ],
    stripePriceId: "price_1UcRTTEqWpT7TrUV8EWUzSbw",
    legacyStripePriceIds: ["price_1U3mzAEqWpT7TrUVKTqZGbiO"],
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Aceleração",
    maxActiveOpportunities: 2000,
    maxUsers: 10,
    maxSearchesPerMonth: 340,
    maxContentPerMonth: 80,
    maxEmailsPerMonth: 10000,
    maxIcps: 1,
    alertsFrequency: "realtime",
    supportTier: "Onboarding + CS dedicado + SLA",
    features: { crmExport: true, inteligenciaCompetitiva: true },
    maxTargetAccountsPerMonth: 1000,
    searchCooldownMs: 3 * HOUR,
    priceMonthlyBRL: 3497,
    mediaBudgetExtra: true,
    recommended: false,
    tagline: "Tudo do Crescimento",
    highlights: [
      "1.000 contas-alvo por mês",
      "Site institucional completo",
      "Gestão de Google Ads e Meta Ads",
      "Conteúdo para redes sociais",
      "Assessoria de marketing mensal",
    ],
    stripePriceId: "price_1UcRTUEqWpT7TrUVDLvufcQ1",
    legacyStripePriceIds: ["price_1U3mzAEqWpT7TrUVo5lX85N1"],
  },
};

export function getPlan(planId: string): PlanDefinition {
  return PLANS[planId as PlanId] ?? PLANS.STARTER;
}

export function getPlanByStripePriceId(stripePriceId: string): PlanDefinition | null {
  return Object.values(PLANS).find((p) => p.stripePriceId === stripePriceId || p.legacyStripePriceIds.includes(stripePriceId)) ?? null;
}
