import { describe, it, expect } from "vitest";
import { parseMoneyInput, parseBrasiliaDateTime, toBrasiliaInput } from "./tender-input";

describe("parseMoneyInput", () => {
  it("entende formato brasileiro e simples", () => {
    expect(parseMoneyInput("R$ 1.234.567,89")).toBe(1234567.89);
    expect(parseMoneyInput("1234,5")).toBe(1234.5);
    expect(parseMoneyInput("1.234")).toBe(1234);
    expect(parseMoneyInput("1234.56")).toBe(1234.56);
    expect(parseMoneyInput("")).toBeNull();
  });
  it("rejeita lixo", () => {
    expect(parseMoneyInput("abc")).toBeUndefined();
    expect(parseMoneyInput("-5")).toBeUndefined();
    expect(parseMoneyInput("1,2,3")).toBeUndefined();
  });
});

describe("parseBrasiliaDateTime", () => {
  it("interpreta como UTC-3 e volta igual", () => {
    const d = parseBrasiliaDateTime("2026-12-01T09:30");
    expect(d?.toISOString()).toBe("2026-12-01T12:30:00.000Z");
    expect(toBrasiliaInput(d!)).toBe("2026-12-01T09:30");
  });
  it("vazio = null; inválido = undefined", () => {
    expect(parseBrasiliaDateTime("")).toBeNull();
    expect(parseBrasiliaDateTime("2026-02-31T10:00")).toBeUndefined();
    expect(parseBrasiliaDateTime("01/12/2026")).toBeUndefined();
  });
});
