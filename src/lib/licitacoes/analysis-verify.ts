// Verificação das fontes citadas pela IA contra o texto REAL extraído do PDF
// no servidor. A IA não é a fonte de verdade sobre o que está no documento:
// cada trecho citado é procurado na página citada; o que não for encontrado
// fica marcado como não confirmado na interface.

export type SourceStatus = "ok" | "documento_nao_encontrado" | "pagina_inexistente" | "trecho_nao_localizado" | "trecho_curto_demais" | "sem_fonte";

export type SourceCheck = {
  total: number;
  verified: number;
  byPath: Record<string, SourceStatus>;
};

export type DocumentPages = { fileName: string; pages: string[] }; // pages[0] = página 1

// Só letras e dígitos, sem acento, minúsculos: tolera quebra de linha, hifenização,
// espaçamento duplo e pontuação diferente entre o PDF e a citação da IA.
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const MIN_QUOTE_CHARS = 12;

export function checkSource(
  fonte: { documento: string; pagina: number; trecho_literal: string },
  docs: DocumentPages[],
): SourceStatus {
  const wanted = fonte.documento.trim().toLowerCase();
  const doc = docs.find((d) => d.fileName.toLowerCase() === wanted) ?? docs.find((d) => d.fileName.toLowerCase().includes(wanted) || wanted.includes(d.fileName.toLowerCase()));
  if (!doc) return "documento_nao_encontrado";

  const idx = fonte.pagina - 1;
  if (!Number.isInteger(fonte.pagina) || idx < 0 || idx >= doc.pages.length) return "pagina_inexistente";

  const quote = normalizeForMatch(fonte.trecho_literal);
  if (quote.length < MIN_QUOTE_CHARS) return "trecho_curto_demais";

  // Aceita citação que atravessa a virada de página (última parte da página
  // + começo da seguinte).
  const page = normalizeForMatch(doc.pages[idx]);
  const next = idx + 1 < doc.pages.length ? normalizeForMatch(doc.pages[idx + 1]) : "";
  if (page.includes(quote)) return "ok";
  // A citação tem que COMEÇAR na página citada; só o final pode cair na seguinte.
  if (next) {
    const start = (page + next).indexOf(quote);
    if (start !== -1 && start < page.length) return "ok";
  }
  return "trecho_nao_localizado";
}

function isCampo(value: unknown): value is { encontrado: boolean; tipo: string; fonte: { documento: string; pagina: number; trecho_literal: string } | null; valor: unknown } {
  return typeof value === "object" && value !== null && "encontrado" in value && "fonte" in value && "tipo" in value;
}

// Percorre o resultado inteiro e confere todo "campo" (objeto com valor/tipo/
// fonte/encontrado). Campos com encontrado=false não precisam de fonte.
export function verifySources(result: unknown, docs: DocumentPages[]): SourceCheck {
  const check: SourceCheck = { total: 0, verified: 0, byPath: {} };

  function walk(node: unknown, path: string) {
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}.${i}`));
      return;
    }
    if (typeof node !== "object" || node === null) return;
    if (isCampo(node)) {
      if (!node.encontrado) return;
      check.total++;
      const status: SourceStatus = node.fonte ? checkSource(node.fonte, docs) : "sem_fonte";
      check.byPath[path] = status;
      if (status === "ok") check.verified++;
      return;
    }
    for (const [key, value] of Object.entries(node)) walk(value, path ? `${path}.${key}` : key);
  }

  walk(result, "");
  return check;
}
