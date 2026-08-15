import { describe, expect, it } from "vitest";
import { isIcpTooGeneric } from "./icp-quality";

const empty = {
  segments: [] as string[],
  states: [] as string[],
  cities: [] as string[],
  decisionMakerTitles: [] as string[],
  technologies: [] as string[],
  keywords: [] as string[],
  productsSold: [] as string[],
  servicesSold: [] as string[],
  idealCustomerDescription: null as string | null,
};

describe("isIcpTooGeneric", () => {
  it("sinaliza o caso real visto em produção: só 'Empresas B2B', nada mais", () => {
    expect(isIcpTooGeneric({ ...empty, segments: ["Empresas B2B"] })).toBe(true);
  });

  it("sinaliza ICP totalmente vazio", () => {
    expect(isIcpTooGeneric(empty)).toBe(true);
  });

  it("não sinaliza quando há descrição livre de verdade, mesmo com só 1 segmento", () => {
    expect(
      isIcpTooGeneric({
        ...empty,
        segments: ["Empresas B2B"],
        idealCustomerDescription: "Indústrias metalúrgicas em expansão que precisam de estruturas customizadas.",
      }),
    ).toBe(false);
  });

  it("não sinaliza uma descrição curta demais (abaixo do mínimo)", () => {
    expect(isIcpTooGeneric({ ...empty, segments: ["Empresas B2B"], idealCustomerDescription: "curto" })).toBe(true);
  });

  it("não sinaliza quando há outro sinal preenchido, mesmo com 1 segmento só", () => {
    expect(isIcpTooGeneric({ ...empty, segments: ["Metalúrgica"], states: ["SP"] })).toBe(false);
  });

  it("não sinaliza quando há mais de 1 segmento específico", () => {
    expect(isIcpTooGeneric({ ...empty, segments: ["Clínicas veterinárias", "Pet shops"] })).toBe(false);
  });
});
