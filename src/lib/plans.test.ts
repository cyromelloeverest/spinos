import { describe, expect, it } from "vitest";
import { getPlan, PLANS } from "./plans";

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
  it("ENTERPRISE não tem nenhum limite numérico (null = ilimitado)", () => {
    expect(PLANS.ENTERPRISE.maxActiveOpportunities).toBeNull();
    expect(PLANS.ENTERPRISE.maxUsers).toBeNull();
    expect(PLANS.ENTERPRISE.maxSearchesPerMonth).toBeNull();
  });

  it("STARTER e PROFISSIONAL têm todos os limites numéricos definidos", () => {
    for (const plan of [PLANS.STARTER, PLANS.PROFISSIONAL]) {
      expect(plan.maxActiveOpportunities).not.toBeNull();
      expect(plan.maxUsers).not.toBeNull();
      expect(plan.maxSearchesPerMonth).not.toBeNull();
    }
  });

  it("os limites crescem (ou ficam ilimitados) a cada tier — nunca diminuem", () => {
    const tiers = [PLANS.STARTER, PLANS.PROFISSIONAL, PLANS.ENTERPRISE];
    for (let i = 1; i < tiers.length; i++) {
      const prev = tiers[i - 1];
      const curr = tiers[i];
      for (const key of ["maxActiveOpportunities", "maxUsers", "maxSearchesPerMonth"] as const) {
        const prevVal = prev[key];
        const currVal = curr[key];
        if (currVal === null) continue; // ilimitado sempre é "maior ou igual"
        expect(prevVal === null || currVal >= prevVal).toBe(true);
      }
    }
  });
});
