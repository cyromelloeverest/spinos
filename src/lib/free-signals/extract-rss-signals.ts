import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { RssItem } from "./rss-news";
import { logError } from "@/lib/log-error";

// Categorias que fazem sentido pra notícia (sem PROCUREMENT — isso é o
// canal do PNCP — nem ICP_MATCH/REGULATORY, que exigem contexto por
// cliente que não existe nesta etapa global).
const ExtractedSignalSchema = z.object({
  itemIndex: z.number().describe("Índice do item na lista original que originou este sinal"),
  companyName: z.string().describe("Nome oficial da empresa citada, limpo — sem sufixo de matéria/veículo"),
  city: z.string().nullable().describe("Cidade da empresa, só se estiver clara no título — senão null"),
  state: z.string().nullable().describe("Sigla UF (ex: SP), só se estiver clara — senão null"),
  category: z.enum([
    "HIRING",
    "EXPANSION",
    "FUNDING",
    "TECHNOLOGY",
    "MARKETING",
    "LEADERSHIP_CHANGE",
    "PARTNERSHIP",
    "AWARD",
    "OTHER",
  ]),
  headline: z.string().describe("Resumo objetivo do sinal em 1 frase, sem sensacionalismo"),
});

const ExtractionResultSchema = z.object({ signals: z.array(ExtractedSignalSchema) });

export type ExtractedSignal = z.infer<typeof ExtractedSignalSchema> & {
  link: string;
  sourceLabel: string;
  pubDate: Date;
};

const MAX_ITEMS_PER_BATCH = 60;

// Uma única chamada barata (Haiku, sem web_search, sem thinking estendido)
// pro lote inteiro do dia — não por item nem por cliente. Só extrai sinais
// de empresa real a partir de texto já coletado; não sai buscando nada.
export async function extractCompanySignalsFromRss(items: RssItem[]): Promise<ExtractedSignal[]> {
  if (items.length === 0) return [];
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  const batch = items.slice(0, MAX_ITEMS_PER_BATCH);
  const listText = batch.map((it, i) => `${i}. [${it.sourceLabel}] ${it.title}`).join("\n");

  const client = new Anthropic({ apiKey });

  let response;
  try {
    response = await client.messages.parse({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      output_config: { format: zodOutputFormat(ExtractionResultSchema) },
      messages: [
        {
          role: "user",
          content: `Abaixo está uma lista numerada de manchetes de notícias brasileiras recentes. Extraia APENAS as que citam uma empresa real (pelo nome) fazendo algo que sinaliza início de ciclo de compra: contratação, expansão física, investimento recebido, nova unidade/fábrica, mudança de liderança, parceria, ou prêmio relevante. Ignore notícias genéricas, de governo/política, opinião, ou que não citem uma empresa específica pelo nome. Nunca invente cidade/estado — se não estiver claro no título, deixe null. itemIndex deve ser exatamente o número da lista.\n\n${listText}`,
        },
      ],
    });
  } catch (err) {
    logError("free-signals: falha ao extrair sinais do RSS", err, { itemCount: batch.length });
    return [];
  }

  if (!response.parsed_output) return [];

  return response.parsed_output.signals
    .filter((s) => batch[s.itemIndex])
    .map((s) => ({
      ...s,
      link: batch[s.itemIndex].link,
      sourceLabel: batch[s.itemIndex].sourceLabel,
      pubDate: batch[s.itemIndex].pubDate,
    }));
}
