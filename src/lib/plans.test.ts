import { describe, expect, it } from "vitest";
import { getPlan, getPlanByStripePriceId, PLANS } from "./plans";

describe("getPlan", () => {
  it("retorna o plano correto para um id válido", () => {
    expect(getPlan("PROFISSIONAL")).toBe(PLANS.PROFISSIONAL);
    expect(getPlan("ENTERPRISE")).toBe(PLANS.ENTERPRISE);
  });

  it("cai pra STARTER quando o id é desconhecido", () => {
    // organization.plan vem do banco como string livre — um valor
    // inválido/legado não deve travar a aplicação, deve degradar pro
    // plano mais restritivo em vez de explodir ou liberar acesso ilimitado.
    expect(getPlan("PLANO_QUE_NAO_EXISTE")).toBe(PLANS.STARTER);
    expect(getPlan("")).toBe(PLANS.STARTER);
  });
});

describe("PLANS", () => {
  // Decisão de negócio 2026-08-11: nenhuma dimensão de nenhum plano fica
  // "ilimitada" — IA, suporte e receita não capturada de conta grande são
  // custo real. Enterprise é o teto mais alto, não "sem teto".
  it("nenhum plano tem dimensão ilimitada — todo limite é um número real", () => {
    for (const plan of Object.values(PLANS)) {
      expect(typeof plan.maxActiveOpportunities).toBe("number");
      expect(typeof plan.maxUsers).toBe("number");
      expect(typeof plan.maxSearchesPerMonth).toBe("number");
      expect(typeof plan.maxIcps).toBe("number");
    }
  });

  it("os limites crescem a cada tier — nunca diminuem", () => {
    const tiers = [PLANS.STARTER, PLANS.PROFISSIONAL, PLANS.ENTERPRISE];
    for (let i = 1; i < tiers.length; i++) {
      const prev = tiers[i - 1];
      const curr = tiers[i];
      for (const key of ["maxActiveOpportunities", "maxUsers", "maxSearchesPerMonth", "maxIcps"] as const) {
        expect(curr[key]).toBeGreaterThanOrEqual(prev[key]);
      }
    }
  });

  it("exportação CRM libera a partir do Profissional", () => {
    expect(PLANS.STARTER.features.crmExport).toBe(false);
    expect(PLANS.PROFISSIONAL.features.crmExport).toBe(true);
    expect(PLANS.ENTERPRISE.features.crmExport).toBe(true);
  });

  it("inteligência competitiva é exclusiva do Enterprise", () => {
    expect(PLANS.STARTER.features.inteligenciaCompetitiva).toBe(false);
    expect(PLANS.PROFISSIONAL.features.inteligenciaCompetitiva).toBe(false);
    expect(PLANS.ENTERPRISE.features.inteligenciaCompetitiva).toBe(true);
  });

  it("cada plano tem um stripePriceId único e um preço mensal positivo", () => {
    const priceIds = new Set<string>();
    for (const plan of Object.values(PLANS)) {
      expect(plan.stripePriceId).toBeTruthy();
      expect(priceIds.has(plan.stripePriceId)).toBe(false);
      priceIds.add(plan.stripePriceId);
      expect(plan.priceMonthlyBRL).toBeGreaterThan(0);
    }
  });

  it("o preço mensal cresce a cada tier", () => {
    expect(PLANS.PROFISSIONAL.priceMonthlyBRL).toBeGreaterThan(PLANS.STARTER.priceMonthlyBRL);
    expect(PLANS.ENTERPRISE.priceMonthlyBRL).toBeGreaterThan(PLANS.PROFISSIONAL.priceMonthlyBRL);
  });
});

describe("getPlanByStripePriceId", () => {
  it("encontra o plano certo pelo Price ID do Stripe", () => {
    expect(getPlanByStripePriceId(PLANS.PROFISSIONAL.stripePriceId)).toBe(PLANS.PROFISSIONAL);
  });

  it("retorna null pra um Price ID desconhecido", () => {
    expect(getPlanByStripePriceId("price_inexistente")).toBeNull();
  });
});
