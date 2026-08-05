const FETCH_TIMEOUT_MS = 4000;
const MAX_HTML_CHARS = 200_000;

const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
];

const OG_IMAGE_PATTERNS = [
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
];

// Busca o og:image (ou twitter:image) da página de origem de um sinal, pra
// dar ao Radar uma foto real em vez de um avatar genérico. Puro scraping de
// metadado HTML — nenhuma chamada de IA envolvida. Falha silenciosamente
// (retorna null) em qualquer erro: rede lenta, site que bloqueia bots, HTML
// sem og:image, etc. — isso nunca deve derrubar uma busca de oportunidades.
export async function fetchOgImage(sourceUrl: string | null | undefined): Promise<string | null> {
  if (!sourceUrl) return null;

  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(url.hostname))) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SpinosBot/1.0; +https://spinos.com.br)",
        Accept: "text/html",
      },
    });
    if (!response.ok || !response.body) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    const html = await readHead(response.body);
    const imageUrl = extractOgImage(html);
    if (!imageUrl) return null;

    try {
      return new URL(imageUrl, url).toString();
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Lê só o começo do documento (até </head> ou um teto de tamanho) — não
// precisamos baixar o artigo inteiro pra achar duas meta tags.
async function readHead(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  try {
    while (html.length < MAX_HTML_CHARS) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return html;
}

function extractOgImage(html: string): string | null {
  for (const pattern of OG_IMAGE_PATTERNS) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}
