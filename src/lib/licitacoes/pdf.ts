import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";

export const MAX_PDF_BYTES = 50 * 1024 * 1024;
export const MAX_PDF_PAGES = 1500;
export const MAX_DOCUMENTS_PER_TENDER = 25;
// Teto de texto por documento (evita um PDF malicioso/gigante lotar o banco).
export const MAX_TEXT_CHARS = 3_000_000;
// Abaixo disso o PDF é tratado como escaneado/sem texto.
const MIN_TEXT_CHARS = 100;

export type PdfCheck = { ok: true } | { ok: false; error: string };

// Confia no CONTEÚDO, não no nome/MIME informado pelo navegador: um PDF de
// verdade começa com "%PDF-" (a spec permite lixo antes, mas só nos
// primeiros 1024 bytes — aceitamos só no início exato, que é o normal).
export function validatePdfBytes(bytes: Uint8Array): PdfCheck {
  if (bytes.byteLength === 0) return { ok: false, error: "O arquivo está vazio." };
  if (bytes.byteLength > MAX_PDF_BYTES) return { ok: false, error: "O arquivo passa de 50 MB." };
  const magic = String.fromCharCode(...bytes.subarray(0, 5));
  if (magic !== "%PDF-") return { ok: false, error: "O arquivo não é um PDF válido." };
  return { ok: true };
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// Nome só pra exibição (o caminho no Storage usa id aleatório, nunca o nome).
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*]/g, "_")
    .trim()
    .slice(0, 150);
  return cleaned || "documento.pdf";
}

// <organizationId>/<tenderId>/<uuid>.pdf — a pasta por organização é a
// fronteira de isolamento no Storage; o servidor confere esse prefixo antes
// de qualquer leitura/finalização.
export function buildStoragePath(organizationId: string, tenderId: string, uuid: string): string {
  return `${organizationId}/${tenderId}/${uuid}.pdf`;
}

export function isOwnStoragePath(path: string, organizationId: string, tenderId: string): boolean {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escape(organizationId)}/${escape(tenderId)}/[0-9a-f-]{36}\\.pdf$`).test(path);
}

// Postgres não aceita NUL em text, e surrogates soltos quebram a codificação.
export function cleanExtractedText(text: string): string {
  return text.replace(/\u0000/g, "").toWellFormed();
}

export type ExtractedPdf =
  | { ok: true; pageCount: number; pages: string[]; status: "OK" | "SEM_TEXTO" }
  | { ok: false; error: string };

export async function extractPdfPages(bytes: Uint8Array): Promise<ExtractedPdf> {
  try {
    // getDocumentProxy assume a posse do buffer — passamos uma cópia.
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    if (pdf.numPages > MAX_PDF_PAGES) return { ok: false, error: `O PDF tem mais de ${MAX_PDF_PAGES} páginas.` };
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    const pages = text.map(cleanExtractedText);
    const total = pages.reduce((n, p) => n + p.trim().length, 0);
    if (total > MAX_TEXT_CHARS) return { ok: false, error: "O texto extraído é grande demais para análise." };
    return { ok: true, pageCount: totalPages, pages, status: total < MIN_TEXT_CHARS ? "SEM_TEXTO" : "OK" };
  } catch {
    return { ok: false, error: "Não foi possível ler o PDF (arquivo corrompido ou protegido por senha)." };
  }
}
