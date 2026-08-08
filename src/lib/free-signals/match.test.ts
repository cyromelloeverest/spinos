import { describe, expect, it } from "vitest";
import { candidatesForIcp, type CandidateSignal } from "./match";

const baseIcp = {
  keywords: [] as string[],
  productsSold: [] as string[],
  servicesSold: [] as string[],
  segments: [] as string[],
  companiesToAvoid: [] as string[],
};

function makeSignal(overrides: Partial<CandidateSignal>): CandidateSignal {
  return {
    signalId: "signal-1",
    companyId: "company-1",
    companyName: "Empresa Teste",
    city: "São Paulo",
    state: "SP",
    category: "OTHER",
    title: "Título genérico",
    description: null,
    ...overrides,
  };
}

describe("candidatesForIcp — pré-filtro determinístico, sem IA", () => {
  it("não inclui candidato sem nenhuma palavra-chave do ICP no texto", () => {
    const icp = { ...baseIcp, keywords: ["estruturas metálicas"] };
    const signal = makeSignal({ title: "Empresa abre vaga de estágio" });
    expect(candidatesForIcp(icp, [signal])).toEqual([]);
  });

  it("inclui candidato quando uma palavra-chave do ICP aparece no título", () => {
    const icp = { ...baseIcp, keywords: ["nova unidade"] };
    const signal = makeSignal({ title: "Empresa inaugura nova unidade em Campinas" });
    expect(candidatesForIcp(icp, [signal])).toEqual([signal]);
  });

  it("busca em productsSold, servicesSold e segments além de keywords", () => {
    const signal = makeSignal({ description: "vai investir em corte a laser este ano" });
    expect(candidatesForIcp({ ...baseIcp, productsSold: ["corte a laser"] }, [signal])).toEqual([signal]);
    expect(candidatesForIcp({ ...baseIcp, servicesSold: ["corte a laser"] }, [signal])).toEqual([signal]);
    expect(candidatesForIcp({ ...baseIcp, segments: ["corte a laser"] }, [signal])).toEqual([signal]);
  });

  it("é case-insensitive", () => {
    const icp = { ...baseIcp, keywords: ["EXPANSÃO"] };
    const signal = makeSignal({ title: "empresa em expansão no interior de sp" });
    expect(candidatesForIcp(icp, [signal])).toEqual([signal]);
  });

  it("nunca inclui uma empresa da lista de exclusão, mesmo com match de palavra-chave", () => {
    const icp = { ...baseIcp, keywords: ["expansão"], companiesToAvoid: ["Empresa Teste"] };
    const signal = makeSignal({ title: "expansão" });
    expect(candidatesForIcp(icp, [signal])).toEqual([]);
  });

  it("ordena por número de acertos e limita a 5 candidatos", () => {
    const icp = { ...baseIcp, keywords: ["a", "b", "c"] };
    const signals = Array.from({ length: 8 }, (_, i) =>
      makeSignal({ signalId: `s${i}`, title: i < 6 ? "a b c" : "a" }),
    );
    const result = candidatesForIcp(icp, signals);
    expect(result).toHaveLength(5);
    expect(result.every((s) => s.title === "a b c")).toBe(true);
  });
});
