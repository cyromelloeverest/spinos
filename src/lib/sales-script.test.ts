import { describe, expect, it } from "vitest";
import { buildSalesScript, type ScriptInput } from "./sales-script";

const baseInput: ScriptInput = {
  companyName: "Empresa Teste",
  headline: "Abriu uma vaga de gerente comercial e está expandindo o time de vendas",
  execSummary: "Resumo executivo.",
  suggestedApproach: "Aborde oferecendo uma demonstração.",
  commercialArguments: ["Argumento 1"],
  objections: ["Objeção 1"],
  buyerArea: "Comercial",
  decisionMaker: "Diretor Comercial",
  contactName: "Ana Ferreira",
  recommendedOffering: null,
  orgName: "Spinos",
};

function extractLinkedinNote(script: string): string {
  const match = script.match(/MENSAGEM DE CONEXÃO NO LINKEDIN[^\n]*\n"([^\n]*)"/);
  if (!match) throw new Error("Nota de conexão não encontrada no script gerado");
  return match[1];
}

describe("buildSalesScript — nota de conexão do LinkedIn", () => {
  it("nunca ultrapassa 200 caracteres, o limite real do LinkedIn", () => {
    const script = buildSalesScript({
      ...baseInput,
      headline:
        "Anunciou expansão da fábrica em Jundiaí com investimento de R$60 milhões e deve contratar centenas de funcionários nos próximos meses para a nova linha de produção",
    });

    const note = extractLinkedinNote(script);
    expect(note.length).toBeLessThanOrEqual(200);
  });

  it("trunca com reticências quando o texto natural passaria de 200 caracteres", () => {
    const script = buildSalesScript({
      ...baseInput,
      headline:
        "Anunciou expansão da fábrica em Jundiaí com investimento de R$60 milhões e deve contratar centenas de funcionários nos próximos meses para a nova linha de produção",
    });

    const note = extractLinkedinNote(script);
    expect(note.endsWith("…")).toBe(true);
    expect(note.length).toBe(200);
  });

  it("não trunca quando o texto natural já cabe dentro do limite", () => {
    const script = buildSalesScript({ ...baseInput, headline: "Abriu uma vaga de gerente comercial" });

    const note = extractLinkedinNote(script);
    expect(note.endsWith("…")).toBe(false);
    expect(note.length).toBeLessThanOrEqual(200);
  });

  it("o rótulo do script também anuncia o limite certo (200, não 300)", () => {
    const script = buildSalesScript(baseInput);
    expect(script).toContain("MENSAGEM DE CONEXÃO NO LINKEDIN (máx. 200 caracteres)");
  });
});
