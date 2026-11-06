import { describe, it, expect } from "vitest";
import { validityStatus, parseDateInput, currentVersions, isHabilitacaoCategory } from "./habilitacao";

const now = new Date("2026-11-06T15:00:00.000Z");

describe("validityStatus", () => {
  it("sem data = sem validade informada (nunca assume vigente)", () => {
    expect(validityStatus(null, now)).toBe("sem_validade");
  });
  it("vence hoje ainda é vigente (vence em breve)", () => {
    expect(validityStatus(new Date("2026-11-06T00:00:00.000Z"), now)).toBe("vence_em_breve");
  });
  it("ontem = vencido", () => {
    expect(validityStatus(new Date("2026-11-05T00:00:00.000Z"), now)).toBe("vencido");
  });
  it("até 30 dias = vence em breve; 31 dias = vigente", () => {
    expect(validityStatus(new Date("2026-12-06T00:00:00.000Z"), now)).toBe("vence_em_breve");
    expect(validityStatus(new Date("2026-12-07T00:00:00.000Z"), now)).toBe("vigente");
  });
});

describe("parseDateInput", () => {
  it("aceita data válida e vazio", () => {
    expect(parseDateInput("2026-12-31")?.toISOString()).toBe("2026-12-31T00:00:00.000Z");
    expect(parseDateInput("")).toBeNull();
  });
  it("rejeita lixo e datas impossíveis", () => {
    expect(parseDateInput("31/12/2026")).toBeUndefined();
    expect(parseDateInput("2026-02-31")).toBeUndefined();
  });
});

describe("currentVersions", () => {
  it("devolve só a versão mais recente de cada cadeia", () => {
    const docs = [
      { id: "a", previousVersionId: null },
      { id: "b", previousVersionId: "a" },
      { id: "c", previousVersionId: null },
    ];
    expect(currentVersions(docs).map((d) => d.id)).toEqual(["b", "c"]);
  });
});

describe("isHabilitacaoCategory", () => {
  it("valida categoria", () => {
    expect(isHabilitacaoCategory("CERTIDAO")).toBe(true);
    expect(isHabilitacaoCategory("OUTRA")).toBe(false);
  });
});
