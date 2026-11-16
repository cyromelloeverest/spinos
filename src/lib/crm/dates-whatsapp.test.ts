import { describe, it, expect } from "vitest";
import { startOfDayBRT, endOfDayBRT, businessDueDate } from "./dates";
import { toWhatsAppUrl, toTelUrl } from "./whatsapp";

describe("dias em horário de Brasília", () => {
  it("o dia começa às 03:00 UTC", () => {
    expect(startOfDayBRT(new Date("2026-11-16T14:00:00Z")).toISOString()).toBe("2026-11-16T03:00:00.000Z");
    // 01:00 UTC ainda é o dia anterior em Brasília
    expect(startOfDayBRT(new Date("2026-11-16T01:00:00Z")).toISOString()).toBe("2026-11-15T03:00:00.000Z");
    expect(endOfDayBRT(new Date("2026-11-16T14:00:00Z")).toISOString()).toBe("2026-11-17T03:00:00.000Z");
  });
  it("prazo em dias úteis cai às 9h de Brasília e pula fim de semana", () => {
    // segunda 16/11/2026 + 1 dia = terça 9h BRT = 12:00Z
    expect(businessDueDate(1, new Date("2026-11-16T14:00:00Z")).toISOString()).toBe("2026-11-17T12:00:00.000Z");
    // sexta 20/11 + 1 = sábado → segunda 23/11
    expect(businessDueDate(1, new Date("2026-11-20T14:00:00Z")).toISOString()).toBe("2026-11-23T12:00:00.000Z");
    // sexta 20/11 + 2 = domingo → segunda 23/11
    expect(businessDueDate(2, new Date("2026-11-20T14:00:00Z")).toISOString()).toBe("2026-11-23T12:00:00.000Z");
  });
});

describe("links de contato", () => {
  it("WhatsApp: acrescenta 55 em número brasileiro e recusa lixo", () => {
    expect(toWhatsAppUrl("(11) 4533-2888")).toBe("https://wa.me/551145332888");
    expect(toWhatsAppUrl("(19) 99999-0000")).toBe("https://wa.me/5519999990000");
    expect(toWhatsAppUrl("+55 19 99999-0000")).toBe("https://wa.me/5519999990000");
    expect(toWhatsAppUrl("123")).toBeNull();
    expect(toWhatsAppUrl(null)).toBeNull();
  });
  it("WhatsApp com texto codifica a mensagem", () => {
    expect(toWhatsAppUrl("11999990000", "Oi, tudo bem?")).toBe("https://wa.me/5511999990000?text=Oi%2C%20tudo%20bem%3F");
  });
  it("tel:", () => {
    expect(toTelUrl("(11) 4533-2888")).toBe("tel:+551145332888");
    expect(toTelUrl("")).toBeNull();
  });
});

import { parseBrasiliaDateTime, toBrasiliaInput } from "./dates";
import { parseMoneyInput } from "./money";

describe("datas digitadas e valores", () => {
  it("datetime-local é Brasília e volta igual", () => {
    const d = parseBrasiliaDateTime("2026-12-01T09:30");
    expect(d?.toISOString()).toBe("2026-12-01T12:30:00.000Z");
    expect(toBrasiliaInput(d)).toBe("2026-12-01T09:30");
    expect(parseBrasiliaDateTime("")).toBeNull();
    expect(parseBrasiliaDateTime("2026-02-31T10:00")).toBeUndefined();
    expect(parseBrasiliaDateTime("01/12/2026")).toBeUndefined();
  });
  it("valor em reais no formato brasileiro", () => {
    expect(parseMoneyInput("R$ 1.234.567,89")).toBe(1234567.89);
    expect(parseMoneyInput("1.234")).toBe(1234);
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("abc")).toBeUndefined();
    expect(parseMoneyInput("-5")).toBeUndefined();
  });
});
