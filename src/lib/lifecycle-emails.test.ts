import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  shouldSendTrialNoSearchEmail,
  shouldSendTrialEndingEmail,
  shouldSendStaleOpportunitiesEmail,
  buildUnsubscribeUrl,
  verifyUnsubscribeToken,
  TRIAL_NO_SEARCH_AFTER_DAYS,
  TRIAL_ENDING_WITHIN_DAYS,
  STALE_OPPORTUNITIES_MIN_COUNT,
  STALE_OPPORTUNITIES_RESEND_COOLDOWN_DAYS,
} from "./lifecycle-emails";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-08-14T12:00:00.000Z");

describe("shouldSendTrialNoSearchEmail", () => {
  const baseOrg = {
    createdAt: new Date(NOW.getTime() - (TRIAL_NO_SEARCH_AFTER_DAYS + 1) * DAY_MS),
    trialEndsAt: new Date(NOW.getTime() + 3 * DAY_MS),
    lifecycleEmailsOptOut: false,
    trialNoSearchEmailSentAt: null,
  };

  it("dispara quando trial ativo, sem busca, e passou o prazo mínimo", () => {
    expect(shouldSendTrialNoSearchEmail(baseOrg, 0, NOW)).toBe(true);
  });

  it("não dispara se já rodou alguma busca", () => {
    expect(shouldSendTrialNoSearchEmail(baseOrg, 1, NOW)).toBe(false);
  });

  it("não dispara antes do prazo mínimo de dias", () => {
    const org = { ...baseOrg, createdAt: NOW };
    expect(shouldSendTrialNoSearchEmail(org, 0, NOW)).toBe(false);
  });

  it("não dispara se o trial já acabou", () => {
    const org = { ...baseOrg, trialEndsAt: new Date(NOW.getTime() - DAY_MS) };
    expect(shouldSendTrialNoSearchEmail(org, 0, NOW)).toBe(false);
  });

  it("não dispara se já foi enviado antes", () => {
    const org = { ...baseOrg, trialNoSearchEmailSentAt: new Date(NOW.getTime() - DAY_MS) };
    expect(shouldSendTrialNoSearchEmail(org, 0, NOW)).toBe(false);
  });

  it("não dispara se a org descadastrou os e-mails de engajamento", () => {
    const org = { ...baseOrg, lifecycleEmailsOptOut: true };
    expect(shouldSendTrialNoSearchEmail(org, 0, NOW)).toBe(false);
  });

  it("não dispara pra conta sem trial (paga, uso interno)", () => {
    const org = { ...baseOrg, trialEndsAt: null };
    expect(shouldSendTrialNoSearchEmail(org, 0, NOW)).toBe(false);
  });
});

describe("shouldSendTrialEndingEmail", () => {
  const baseOrg = {
    trialEndsAt: new Date(NOW.getTime() + (TRIAL_ENDING_WITHIN_DAYS - 1) * DAY_MS),
    lifecycleEmailsOptOut: false,
    trialEndingEmailSentAt: null,
  };

  it("dispara dentro da janela final do trial", () => {
    expect(shouldSendTrialEndingEmail(baseOrg, NOW)).toBe(true);
  });

  it("não dispara fora da janela (trial termina muito no futuro)", () => {
    const org = { ...baseOrg, trialEndsAt: new Date(NOW.getTime() + 10 * DAY_MS) };
    expect(shouldSendTrialEndingEmail(org, NOW)).toBe(false);
  });

  it("não dispara se o trial já acabou", () => {
    const org = { ...baseOrg, trialEndsAt: new Date(NOW.getTime() - DAY_MS) };
    expect(shouldSendTrialEndingEmail(org, NOW)).toBe(false);
  });

  it("não dispara se já foi enviado antes", () => {
    const org = { ...baseOrg, trialEndingEmailSentAt: new Date(NOW.getTime() - DAY_MS) };
    expect(shouldSendTrialEndingEmail(org, NOW)).toBe(false);
  });

  it("não dispara pra conta sem trial", () => {
    const org = { ...baseOrg, trialEndsAt: null };
    expect(shouldSendTrialEndingEmail(org, NOW)).toBe(false);
  });
});

describe("shouldSendStaleOpportunitiesEmail", () => {
  const baseOrg = { lifecycleEmailsOptOut: false, staleOpportunitiesEmailSentAt: null };

  it("dispara quando atinge o mínimo de oportunidades paradas", () => {
    expect(shouldSendStaleOpportunitiesEmail(baseOrg, STALE_OPPORTUNITIES_MIN_COUNT, NOW)).toBe(true);
  });

  it("não dispara abaixo do mínimo", () => {
    expect(shouldSendStaleOpportunitiesEmail(baseOrg, STALE_OPPORTUNITIES_MIN_COUNT - 1, NOW)).toBe(false);
  });

  it("não reenvia dentro do cooldown", () => {
    const org = {
      ...baseOrg,
      staleOpportunitiesEmailSentAt: new Date(NOW.getTime() - (STALE_OPPORTUNITIES_RESEND_COOLDOWN_DAYS - 1) * DAY_MS),
    };
    expect(shouldSendStaleOpportunitiesEmail(org, STALE_OPPORTUNITIES_MIN_COUNT, NOW)).toBe(false);
  });

  it("reenvia depois do cooldown, se ainda parado", () => {
    const org = {
      ...baseOrg,
      staleOpportunitiesEmailSentAt: new Date(NOW.getTime() - (STALE_OPPORTUNITIES_RESEND_COOLDOWN_DAYS + 1) * DAY_MS),
    };
    expect(shouldSendStaleOpportunitiesEmail(org, STALE_OPPORTUNITIES_MIN_COUNT, NOW)).toBe(true);
  });

  it("não dispara se a org descadastrou", () => {
    const org = { ...baseOrg, lifecycleEmailsOptOut: true };
    expect(shouldSendStaleOpportunitiesEmail(org, STALE_OPPORTUNITIES_MIN_COUNT, NOW)).toBe(false);
  });
});

describe("unsubscribe token", () => {
  beforeEach(() => {
    vi.stubEnv("LIFECYCLE_EMAIL_SECRET", "test-secret-value");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("o token gerado no link de descadastro é aceito na verificação", () => {
    const url = buildUnsubscribeUrl("org_123");
    const token = new URL(url).searchParams.get("token")!;
    expect(verifyUnsubscribeToken("org_123", token)).toBe(true);
  });

  it("rejeita token de outra organização", () => {
    const url = buildUnsubscribeUrl("org_123");
    const token = new URL(url).searchParams.get("token")!;
    expect(verifyUnsubscribeToken("org_456", token)).toBe(false);
  });

  it("rejeita token adulterado", () => {
    expect(verifyUnsubscribeToken("org_123", "token-forjado")).toBe(false);
  });
});
