import "server-only";
import { logError } from "@/lib/log-error";

export type RssItem = {
  title: string;
  link: string;
  pubDate: Date;
  sourceLabel: string;
};

// Consultas amplas de sinal de negócio — não são por cliente, é a mesma
// coleta pra todo mundo (Signal é global). Cada uma vira uma busca no feed
// de notícias do Google, sem custo nenhum (sem chave de API).
const RSS_QUERIES = [
  "expansão nova unidade fábrica Brasil",
  "empresa investe milhões Brasil",
  "abre vagas contratação Brasil",
  "recebe investimento rodada aporte Brasil",
  "nova planta indústria Brasil",
];

const MAX_ITEM_AGE_MS = 5 * 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  for (const [, itemXml] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim();
    const link = itemXml.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim();
    const pubDateRaw = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim();
    const sourceLabel = itemXml.match(/<source url="[^"]*"[^>]*>([\s\S]*?)<\/source>/)?.[1]?.trim();
    if (!title || !link || !pubDateRaw) continue;
    const pubDate = new Date(pubDateRaw);
    if (Number.isNaN(pubDate.getTime())) continue;
    items.push({ title, link, pubDate, sourceLabel: sourceLabel ?? "Google News" });
  }
  return items;
}

// Busca sinais de negócio no Google News RSS — sem IA, sem chave de API,
// sem custo. A extração de "isso é uma empresa real fazendo algo relevante"
// acontece depois, em extract-rss-signals.ts (aí sim com um passo de IA,
// mas barato: 1 chamada Haiku pro lote inteiro, não por item).
export async function fetchRssSignalCandidates(): Promise<RssItem[]> {
  const all: RssItem[] = [];
  const cutoff = Date.now() - MAX_ITEM_AGE_MS;

  for (const query of RSS_QUERIES) {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-BR`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) continue;
      const xml = await res.text();
      all.push(...parseRssItems(xml).filter((item) => item.pubDate.getTime() >= cutoff));
    } catch (err) {
      // Uma fonte fora do ar não derruba a coleta inteira.
      logError("free-signals: falha ao buscar RSS", err, { query });
    }
  }

  const seen = new Set<string>();
  return all.filter((item) => (seen.has(item.link) ? false : (seen.add(item.link), true)));
}
