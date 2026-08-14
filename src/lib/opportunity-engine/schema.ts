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
  sourceUrl: z
    .string()
    .nullable()
    .describe(
      "URL de uma PÁGINA REAL de conteúdo que comprova o sinal (site da empresa, notícia, LinkedIn, edital) — NUNCA um link de página de resultado de busca (ex: google.com/search, bing.com/search). Null se o sinal for uma inferência de encaixe de perfil (categoria ICP_MATCH) sem uma página específica por trás — nunca invente uma URL só pra preencher o campo.",
    ),
  sourceLabel: z.string().describe("Nome legível da fonte, ex: nome do site/veículo"),
});

export const OpportunitySchema = z.object({
  companyName: z
    .string()
    .describe(
      "Nome oficial da empresa, limpo — sem parênteses, sigla de unidade/planta ou descrição do que ela faz (isso vai em execSummary/headline, não aqui). Ex: \"Sigvaris Group\", não \"Sigvaris Group (unidade Jundiaí)\".",
    ),
  city: z
    .string()
    .nullable()
    .describe(
      "Cidade da empresa, SOMENTE se confirmada em fonte pública real (site oficial, LinkedIn, notícia, cadastro público) — nunca assuma pela proximidade com a contratante ou porque bateria com o raio do ICP. Null se não encontrar confirmação real.",
    ),
  state: z
    .string()
    .nullable()
    .describe("Estado (UF) da empresa, mesma regra de city — null se não confirmado em fonte real, nunca estimado."),
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
  objections: z
    .array(z.string())
    .describe(
      "Objeções mais prováveis que o decisor vai levantar. Cada item precisa ter a objeção E a resposta sugerida na mesma string, formato 'Objeção: ... → Resposta sugerida: ...'. Nunca deixe só a objeção sem a resposta embutida.",
    ),
  signals: z.array(SignalSchema),
});

export const OpportunitySearchResultSchema = z.object({
  opportunities: z.array(OpportunitySchema),
});

export type OpportunitySearchResult = z.infer<typeof OpportunitySearchResultSchema>;
