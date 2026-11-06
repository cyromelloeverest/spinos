import { describe, it, expect } from "vitest";
import { validatePdfBytes, sha256Hex, sanitizeFileName, buildStoragePath, isOwnStoragePath, extractPdfPages, cleanExtractedText } from "./pdf";

const enc = (s: string) => new TextEncoder().encode(s);

// PDF mínimo de 2 páginas, escrito à mão (sem xref válido: o leitor reconstrói).
function tinyPdf(texts: string[]): Uint8Array {
  const objs: string[] = [];
  const kids = texts.map((_, i) => `${4 + i * 2} 0 R`).join(" ");
  objs.push("1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj");
  objs.push(`2 0 obj<</Type/Pages/Kids[${kids}]/Count ${texts.length}>>endobj`);
  objs.push("3 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj");
  texts.forEach((t, i) => {
    const pageId = 4 + i * 2;
    const contentId = pageId + 1;
    const stream = `BT /F1 12 Tf 50 700 Td (${t}) Tj ET`;
    objs.push(`${pageId} 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 3 0 R>>>>/Contents ${contentId} 0 R>>endobj`);
    objs.push(`${contentId} 0 obj<</Length ${stream.length}>>stream\n${stream}\nendstream endobj`);
  });
  return enc(`%PDF-1.4\n${objs.join("\n")}\ntrailer<</Root 1 0 R>>\n%%EOF`);
}

describe("validatePdfBytes", () => {
  it("aceita assinatura %PDF-", () => {
    expect(validatePdfBytes(enc("%PDF-1.7\n..."))).toEqual({ ok: true });
  });
  it("rejeita vazio, não-PDF e PDF renomeado", () => {
    expect(validatePdfBytes(new Uint8Array())).toMatchObject({ ok: false });
    expect(validatePdfBytes(enc("MZ\x90\x00 executavel.pdf"))).toMatchObject({ ok: false });
    expect(validatePdfBytes(enc("<html>edital.pdf</html>"))).toMatchObject({ ok: false });
  });
});

describe("sha256Hex", () => {
  it("é determinístico", () => {
    expect(sha256Hex(enc("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("sanitizeFileName", () => {
  it("remove caminho e caracteres de controle", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\x\\edital<1>.pdf")).toBe("edital_1_.pdf");
    expect(sanitizeFileName("")).toBe("documento.pdf");
  });
});

describe("storage path", () => {
  const uuid = "123e4567-e89b-12d3-a456-426614174000";
  it("aceita só o próprio prefixo org/licitação", () => {
    const p = buildStoragePath("orgA", "t1", uuid);
    expect(isOwnStoragePath(p, "orgA", "t1")).toBe(true);
    expect(isOwnStoragePath(p, "orgB", "t1")).toBe(false);
    expect(isOwnStoragePath(p, "orgA", "t2")).toBe(false);
    expect(isOwnStoragePath(`orgA/t1/../orgB/t1/${uuid}.pdf`, "orgA", "t1")).toBe(false);
    expect(isOwnStoragePath(`orgA/t1/x.pdf`, "orgA", "t1")).toBe(false);
  });
});

describe("cleanExtractedText", () => {
  it("remove NUL e surrogates soltos", () => {
    expect(cleanExtractedText("a\u0000b\ud800c")).toBe("ab\ufffdc");
  });
});

describe("extractPdfPages", () => {
  it("extrai texto por página", async () => {
    const bytes = tinyPdf([
      "Pagina um do edital com texto suficiente para contar como texto real extraido do documento enviado pela empresa.",
      "Pagina dois traz a exigencia de atestado de capacidade tecnica compativel com o objeto da licitacao.",
    ]);
    const r = await extractPdfPages(bytes);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pageCount).toBe(2);
      expect(r.pages[0]).toContain("Pagina um");
      expect(r.pages[1]).toContain("atestado de capacidade");
      expect(r.status).toBe("OK");
    }
  });
  it("marca SEM_TEXTO quando não há texto", async () => {
    const r = await extractPdfPages(tinyPdf([""]));
    expect(r.ok && r.status).toBe("SEM_TEXTO");
  });
  it("falha de forma controlada em arquivo corrompido", async () => {
    const r = await extractPdfPages(enc("%PDF-1.4 lixo"));
    expect(r.ok).toBe(false);
  });
});
