import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SUPPRESS_EVENTS, verifyResendWebhook } from "./webhook";

const secretRaw = Buffer.from("chave-super-secreta-do-webhook");
const secret = `whsec_${secretRaw.toString("base64")}`;
const body = JSON.stringify({ type: "email.bounced", data: { email_id: "abc" } });
const sign = (id: string, ts: string, b = body) => `v1,${createHmac("sha256", secretRaw).update(`${id}.${ts}.${b}`).digest("base64")}`;
const now = Date.UTC(2026, 10, 16, 12, 0, 0);
const ts = String(Math.floor(now / 1000));

describe("webhook do Resend", () => {
  it("aceita assinatura correta", () => {
    expect(verifyResendWebhook(secret, { id: "msg_1", timestamp: ts, signature: sign("msg_1", ts) }, body, now)).toBe(true);
  });
  it("aceita quando há várias assinaturas e uma delas confere", () => {
    expect(verifyResendWebhook(secret, { id: "msg_1", timestamp: ts, signature: `v1,errada ${sign("msg_1", ts)}` }, body, now)).toBe(true);
  });
  it("recusa corpo alterado, id trocado, segredo errado e cabeçalho ausente", () => {
    const good = sign("msg_1", ts);
    expect(verifyResendWebhook(secret, { id: "msg_1", timestamp: ts, signature: good }, body + " ", now)).toBe(false);
    expect(verifyResendWebhook(secret, { id: "msg_2", timestamp: ts, signature: good }, body, now)).toBe(false);
    expect(verifyResendWebhook("whsec_" + Buffer.from("outro").toString("base64"), { id: "msg_1", timestamp: ts, signature: good }, body, now)).toBe(false);
    expect(verifyResendWebhook(secret, { id: null, timestamp: ts, signature: good }, body, now)).toBe(false);
    expect(verifyResendWebhook(secret, { id: "msg_1", timestamp: ts, signature: null }, body, now)).toBe(false);
  });
  it("recusa mensagem velha (repetição)", () => {
    const old = String(Math.floor(now / 1000) - 600);
    expect(verifyResendWebhook(secret, { id: "msg_1", timestamp: old, signature: sign("msg_1", old) }, body, now)).toBe(false);
  });
  it("só bounce e reclamação suprimem", () => {
    expect(SUPPRESS_EVENTS["email.bounced"]).toBe("BOUNCE");
    expect(SUPPRESS_EVENTS["email.complained"]).toBe("COMPLAINT");
    expect(SUPPRESS_EVENTS["email.delivered"]).toBeUndefined();
  });
});
