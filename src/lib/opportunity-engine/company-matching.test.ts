import { describe, expect, it } from "vitest";
import { findBestMatch, normalizeCompanyName } from "./company-matching";

describe("normalizeCompanyName", () => {
  it("remove acentos", () => {
    expect(normalizeCompanyName("São Paulo Química")).toBe("sao paulo quimica");
  });

  it("remove stopwords e sufixos societários", () => {
    expect(normalizeCompanyName("Sany Brasil Ltda")).toBe("sany");
  });

  it("remove conteúdo entre parênteses", () => {
    expect(normalizeCompanyName("Sany Brasil (Sany Heavy Industry)")).toBe("sany");
  });

  it("remove pontuação e normaliza espaços", () => {
    expect(normalizeCompanyName("Grupo   ACME  S/A.")).toBe("acme");
  });

  it("retorna string vazia quando só há stopwords", () => {
    expect(normalizeCompanyName("Brasil Ltda")).toBe("");
  });
});

describe("findBestMatch", () => {
  const pool = [
    { id: "1", name: "Sany Brasil", city: "Contagem", state: "MG" },
    { id: "2", name: "Acme Ltda", city: "São Paulo", state: "SP" },
    { id: "3", name: "Vale S.A.", city: null, state: "MG" },
  ];

  it("encontra a mesma empresa com nome levemente diferente", () => {
    const match = findBestMatch("Sany Brasil (Sany Heavy Industry)", "Contagem", pool);
    expect(match?.id).toBe("1");
  });

  it("não casa nomes com baixa similaridade", () => {
    const match = findBestMatch("Empresa Completamente Diferente", "Contagem", pool);
    expect(match).toBeNull();
  });

  it("não casa quando a cidade diverge e ambas são conhecidas", () => {
    const match = findBestMatch("Sany Brasil", "Belo Horizonte", pool);
    expect(match).toBeNull();
  });

  it("casa por nome mesmo sem cidade candidata (unidade desconhecida)", () => {
    const match = findBestMatch("Sany Brasil", null, pool);
    expect(match?.id).toBe("1");
  });

  it("casa quando a empresa do pool não tem cidade cadastrada", () => {
    const match = findBestMatch("Vale", "Rio de Janeiro", pool);
    expect(match?.id).toBe("3");
  });

  it("retorna null para nome vazio ou só stopwords", () => {
    expect(findBestMatch("", "Contagem", pool)).toBeNull();
    expect(findBestMatch("Brasil Ltda", "Contagem", pool)).toBeNull();
  });

  it("retorna null para pool vazio", () => {
    expect(findBestMatch("Sany Brasil", "Contagem", [])).toBeNull();
  });

  it("prefere o candidato com maior similaridade entre dois acima do threshold", () => {
    const ambiguousPool = [
      { id: "b", name: "Acme Norte Oeste", city: "São Paulo", state: "SP" }, // overlap 2/3 = 0.66
      { id: "c", name: "Acme Norte Leste Sul", city: "São Paulo", state: "SP" }, // overlap 3/3 = 1.0
    ];
    const match = findBestMatch("Acme Norte Leste", "São Paulo", ambiguousPool);
    expect(match?.id).toBe("c");
  });

  it("em empate exato de similaridade, mantém o primeiro candidato encontrado", () => {
    const tiedPool = [
      { id: "a", name: "Acme Industria e Comercio", city: "São Paulo", state: "SP" },
      { id: "b", name: "Acme", city: "São Paulo", state: "SP" },
    ];
    // Ambos normalizam pra "acme" e batem 100% com a busca — é um empate
    // genuíno, então o algoritmo (que só substitui em ">", não ">=") fica
    // com o primeiro do pool. Documentamos esse comportamento aqui para que
    // uma mudança futura no critério de desempate seja intencional, não acidental.
    const match = findBestMatch("Acme", "São Paulo", tiedPool);
    expect(match?.id).toBe("a");
  });
});
