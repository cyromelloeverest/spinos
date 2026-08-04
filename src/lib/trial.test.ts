import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isTrialExpired, newTrialEndsAt, trialDaysLeft, TRIAL_DAYS } from "./trial";

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
