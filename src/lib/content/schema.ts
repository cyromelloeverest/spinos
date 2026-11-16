import { z } from "zod";

export const CONTENT_KINDS = ["IDEA", "SOCIAL_POST", "ARTICLE", "EMAIL"] as const;
export type ContentKindKey = (typeof CONTENT_KINDS)[number];
export const CHANNELS = ["INSTAGRAM", "LINKEDIN"] as const;

export const KIND_LABEL: Record<ContentKindKey, string> = { IDEA: "Ideias de posts", SOCIAL_POST: "Post para rede social", ARTICLE: "Artigo", EMAIL: "Texto de e-mail" };

export const requestSchema = z.object({
  kind: z.enum(CONTENT_KINDS),
  topic: z.string().trim().min(3, "Descreva o assunto com pelo menos 3 letras").max(300, "Assunto longo demais (máximo 300 letras)"),
  channel: z.enum(CHANNELS).nullable().optional(),
});
export type ContentRequest = z.infer<typeof requestSchema>;

// Saída pedida à IA. Campos de fato são anuláveis/listas para a IA poder dizer "não confirmei"
// em vez de chutar (mesma regra do schema da busca).
export const ideasOutputSchema = z.object({
  ideas: z
    .array(
      z.object({
        title: z.string().describe("Título curto da ideia"),
        hook: z.string().describe("Primeira frase que prende a atenção, sem exagero"),
        angle: z.string().describe("O que o conteúdo explica e por que interessa ao público"),
        format: z.enum(["POST", "CARROSSEL", "REEL", "ARTIGO"]),
      }),
    )
    .describe("Exatamente 5 ideias distintas"),
});

export const textOutputSchema = z.object({
  title: z.string().describe("Título (no e-mail, o assunto)"),
  body: z.string().describe("Texto completo, em português do Brasil"),
  sources: z.array(z.object({ label: z.string(), url: z.string() })).describe("Fontes reais e oficiais que sustentam dados, prazos ou regras citados. Vazio se o texto não cita nenhum"),
  toVerify: z.array(z.string()).describe("Pontos que o profissional deve conferir antes de usar: datas, valores, percentuais, regras que mudam"),
});

export type IdeasOutput = z.infer<typeof ideasOutputSchema>;
export type TextOutput = z.infer<typeof textOutputSchema>;
export type ModelResult = { ideas: IdeasOutput | null; text: TextOutput | null; usage: { input: number; output: number } };
export type ModelCall = (args: { prompt: string; kind: ContentKindKey; useSearch: boolean }) => Promise<ModelResult>;
