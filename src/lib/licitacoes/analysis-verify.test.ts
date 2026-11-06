import { describe, it, expect } from "vitest";
import { normalizeForMatch, checkSource, verifySources, type DocumentPages } from "./analysis-verify";

const docs: DocumentPages[] = [
  {
    fileName: "Edital 12-2026.pdf",
    pages: [
      "PREGÃO ELETRÔNICO Nº 12/2026\nA sessão pública será realizada em 10 de dezembro de 2026, às 09h00.",
      "As propostas deverão ter validade mínima de 60 (sessenta)\ndias, contados da data da aber-\ntura da sessão.",
      "Último parágrafo desta página termina assim: apresentar atestado de capaci-",
      "dade técnica compatível com o objeto.",
    ],
  },
];

describe("normalizeForMatch", () => {
  it("ignora acento, caixa, pontuação e quebra de linha", () => {
    expect(normalizeForMatch("Validade  mínima, de 60 (sessenta)\ndias")).toBe("validademinimade60sessentadias");
  });
});

describe("checkSource", () => {
  it("aceita trecho literal na página citada, mesmo com hifenização", () => {
    expect(checkSource({ documento: "Edital 12-2026.pdf", pagina: 2, trecho_literal: "validade mínima de 60 (sessenta) dias, contados da data da abertura da sessão" }, docs)).toBe("ok");
  });
  it("aceita citação que atravessa a virada de página", () => {
    expect(checkSource({ documento: "Edital 12-2026.pdf", pagina: 3, trecho_literal: "apresentar atestado de capacidade técnica compatível com o objeto" }, docs)).toBe("ok");
  });
  it("reprova trecho inventado, página errada e documento inexistente", () => {
    expect(checkSource({ documento: "Edital 12-2026.pdf", pagina: 1, trecho_literal: "o licitante deverá apresentar garantia de 5% do valor global" }, docs)).toBe("trecho_nao_localizado");
    expect(checkSource({ documento: "Edital 12-2026.pdf", pagina: 1, trecho_literal: "validade mínima de 60 (sessenta) dias" }, docs)).toBe("trecho_nao_localizado");
    expect(checkSource({ documento: "Edital 12-2026.pdf", pagina: 99, trecho_literal: "qualquer trecho comprido o bastante" }, docs)).toBe("pagina_inexistente");
    expect(checkSource({ documento: "Outro.pdf", pagina: 1, trecho_literal: "qualquer trecho comprido o bastante" }, docs)).toBe("documento_nao_encontrado");
  });
  it("trecho curto demais não comprova nada", () => {
    expect(checkSource({ documento: "Edital 12-2026.pdf", pagina: 1, trecho_literal: "2026" }, docs)).toBe("trecho_curto_demais");
  });
});

describe("verifySources", () => {
  const campoOk = { valor: "10/12/2026 09h00", tipo: "fato", encontrado: true, fonte: { documento: "Edital 12-2026.pdf", pagina: 1, trecho_literal: "A sessão pública será realizada em 10 de dezembro de 2026" } };
  const campoFalso = { valor: "5%", tipo: "fato", encontrado: true, fonte: { documento: "Edital 12-2026.pdf", pagina: 1, trecho_literal: "garantia contratual de cinco por cento do valor" } };
  const campoSemFonte = { valor: "x", tipo: "fato", encontrado: true, fonte: null };
  const naoEncontrado = { valor: null, tipo: "fato", encontrado: false, fonte: null };

  it("confere todos os campos, inclusive dentro de listas, e ignora os não encontrados", () => {
    const r = verifySources({ prazos: { abertura: campoOk, garantia: campoFalso, vazio: naoEncontrado }, riscos: [{ severidade: "alta", descricao: campoSemFonte }] }, docs);
    expect(r.total).toBe(3);
    expect(r.verified).toBe(1);
    expect(r.byPath["prazos.abertura"]).toBe("ok");
    expect(r.byPath["prazos.garantia"]).toBe("trecho_nao_localizado");
    expect(r.byPath["riscos.0.descricao"]).toBe("sem_fonte");
    expect(r.byPath["prazos.vazio"]).toBeUndefined();
  });
});
