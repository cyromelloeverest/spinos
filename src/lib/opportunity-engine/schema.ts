import { z } from "zod";

export const SignalCategoryEnum = z.enum([
  "HIRING",
  "EXPANSION",
  "FUNDING",
  "TECHNOLOGY",
  "MARKETING",
  "LEADERSHIP_CHANGE",
  "PROCUREMENT",
  "REGULATORY",
  "PARTNERSHIP",
  "AWARD",
  "EVENT",
  "ICP_MATCH",
  "OTHER",
]);

export const UrgencyEnum = z.enum(["ALTA", "MEDIA", "BAIXA"]);

export const SignalSchema = z.object({
  category: SignalCategoryEnum,
  text: z.string().describe("Descrição objetiva do sinal público encontrado"),
  sourceUrl: z.string().describe("URL da fonte que comprova o sinal"),
  sourceLabel: z.string().describe("Nome legível da fonte, ex: nome do site/veículo"),
});

export const OpportunitySchema = z.object({
  companyName: z.string(),
  city: z.string(),
  state: z.string(),
  score: z.number().describe("Opportunity Score de 0 a 100"),
  urgency: UrgencyEnum,
  headline: z.string().describe("Uma frase resumindo por que abordar agora"),
  execSummary: z.string().describe("Resumo executivo de 3-5 frases"),
  reasoning: z.string().describe("Por que este score específico foi atribuído"),
  buyerArea: z.string().describe("Área da empresa provavelmente comprando"),
  decisionMaker: z.string().describe("Cargo do decisor provável"),
  decisionMakerName: z
    .string()
    .nullable()
    .describe(
      "Nome real de uma pessoa específica, SOMENTE se encontrado em fonte pública verificável (LinkedIn, página \"quem somos\", matéria de imprensa). Null se não tiver certeza razoável — nunca invente um nome.",
    ),
  approach: z.string().describe("Como iniciar a conversa comercial"),
  commercialArguments: z.array(z.string()),
  objections: z.array(z.string()),
  signals: z.array(SignalSchema),
});

export const OpportunitySearchResultSchema = z.object({
  opportunities: z.array(OpportunitySchema),
});

export type OpportunitySearchResult = z.infer<typeof OpportunitySearchResultSchema>;
