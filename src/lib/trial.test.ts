import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isTrialExpired,
  newTrialEndsAt,
  trialDaysLeft,
  effectiveLimits,
  TRIAL_DAYS,
  TRIAL_MAX_SEARCHES,
  TRIAL_MAX_ACTIVE_OPPORTUNITIES,
} from "./trial";
import { PLANS } from "@/lib/plans";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("newTrialEndsAt", () => {
  it("usa TRIAL_DAYS por padrão", () => {
    const before = Date.now();
    const result = newTrialEndsAt();
    const after = Date.now();
    expect(result.getTime()).toBeGreaterThanOrEqual(before + TRIAL_DAYS * DAY_MS);
    expect(result.getTime()).toBeLessThanOrEqual(after + TRIAL_DAYS * DAY_MS);
  });

  it("aceita um número de dias customizado (ex: extensão de +30 dias pelo admin)", () => {
    const before = Date.now();
    const result = newTrialEndsAt(30);
    expect(result.getTime()).toBeGreaterThanOrEqual(before + 30 * DAY_MS);
  });
});

describe("isTrialExpired", () => {
  it("null significa trial sem limite (nunca expira)", () => {
    expect(isTrialExpired(null)).toBe(false);
  });

  it("data no passado está expirada", () => {
    expect(isTrialExpired(new Date(Date.now() - DAY_MS))).toBe(true);
  });

  it("data no futuro não está expirada", () => {
    expect(isTrialExpired(new Date(Date.now() + DAY_MS))).toBe(false);
  });
});

describe("trialDaysLeft", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-04T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retorna null quando não há trial (ilimitado)", () => {
    expect(trialDaysLeft(null)).toBeNull();
  });

  it("arredonda pra cima dias parciais restantes", () => {
    const endsAt = new Date(Date.now() + 2.5 * DAY_MS);
    expect(trialDaysLeft(endsAt)).toBe(3);
  });

  it("retorna 0 quando o trial expira exatamente agora", () => {
    expect(trialDaysLeft(new Date(Date.now()))).toBe(0);
  });

  it("retorna negativo quando já passou do prazo (trial expirado)", () => {
    const endsAt = new Date(Date.now() - 2 * DAY_MS);
    expect(trialDaysLeft(endsAt)).toBe(-2);
  });
});

describe("effectiveLimits", () => {
  it("trial usa o teto fixo do trial, mesmo escolhendo testar o plano Enterprise", () => {
    const result = effectiveLimits({ plan: "ENTERPRISE", trialEndsAt: new Date(Date.now() + DAY_MS) });
    expect(result).toEqual({
      maxActiveOpportunities: TRIAL_MAX_ACTIVE_OPPORTUNITIES,
      maxSearches: TRIAL_MAX_SEARCHES,
      isTrialing: true,
    });
  });

  it("trial usa o teto fixo do trial também nos planos Starter/Profissional", () => {
    const result = effectiveLimits({ plan: "STARTER", trialEndsAt: new Date(Date.now() + DAY_MS) });
    expect(result.maxActiveOpportunities).toBe(TRIAL_MAX_ACTIVE_OPPORTUNITIES);
    expect(result.maxSearches).toBe(TRIAL_MAX_SEARCHES);
  });

  it("sem trial (trialEndsAt null), usa o limite real do plano", () => {
    const result = effectiveLimits({ plan: "STARTER", trialEndsAt: null });
    expect(result).toEqual({
      maxActiveOpportunities: PLANS.STARTER.maxActiveOpportunities,
      maxSearches: PLANS.STARTER.maxSearchesPerMonth,
      isTrialing: false,
    });
  });

  it("sem trial e no Enterprise, usa o teto real do plano — não é mais ilimitado", () => {
    const result = effectiveLimits({ plan: "ENTERPRISE", trialEndsAt: null });
    expect(result).toEqual({
      maxActiveOpportunities: PLANS.ENTERPRISE.maxActiveOpportunities,
      maxSearches: PLANS.ENTERPRISE.maxSearchesPerMonth,
      isTrialing: false,
    });
  });
});
