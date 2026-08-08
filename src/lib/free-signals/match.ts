import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { prismaAdmin } from "@/lib/prisma-admin";
import { withOrgContext } from "@/lib/db/with-org-context";
import { effectiveLimits, isTrialExpired } from "@/lib/trial";
import { logError } from "@/lib/log-error";
import type { IngestedSignal } from "./ingest";

const MAX_CANDIDATES_PER_ORG = 5;
const MIN_KEYWORD_HITS = 1;

const MatchedOpportunitySchema = z.object({
  candidateIndex: z.number().describe("Índice do candidato na lista fornecida"),
  score: z.number().describe("Opportunity Score de 0 a 100"),
  urgency: z.enum(["ALTA", "MEDIA", "BAIXA"]),
  headline: z.string().describe("Uma frase resumindo por que abordar agora"),
  execSummary: z.string().describe("Resumo executivo de 3-5 frases"),
  reasoning: z.string().describe("Por que este score específico foi atribuído"),
  buyerArea: z.string().nullable(),
  decisionMaker: z.string().nullable(),
  decisionMakerName: z.string().nullable().describe("Só se vier claramente identificado no texto fornecido — nunca invente"),
  approach: z.string().describe("Como iniciar a conversa comercial"),
  commercialArguments: z.array(z.string()),
  objections: z.array(z.string()),
});
const MatchResultSchema = z.object({ opportunities: z.array(MatchedOpportunitySchema) });

export type CandidateSignal = {
  signalId: string;
  companyId: string;
  companyName: string;
  city: string | null;
  state: string | null;
  category: string;
  title: string;
  description: string | null;
};

function keywordHits(icp: { keywords: string[]; productsSold: string[]; servicesSold: string[]; segments: string[] }, haystack: string): number {
  const needles = [...icp.keywords, ...icp.productsSold, ...icp.servicesSold, ...icp.segments].map((s) => s.toLowerCase()).filter(Boolean);
  let hits = 0;
  for (const needle of needles) if (haystack.includes(needle)) hits++;
  return hits;
}

// Pré-filtro 100% determinístico (zero IA, zero custo) — só os candidatos
// que batem com o ICP por palavra-chave chegam na chamada de IA abaixo.
export function candidatesForIcp(
  icp: { keywords: string[]; productsSold: string[]; servicesSold: string[]; segments: string[]; companiesToAvoid: string[] },
  signals: CandidateSignal[],
): CandidateSignal[] {
  const avoid = new Set(icp.companiesToAvoid.map((c) => c.toLowerCase()));
  return signals
    .filter((s) => !avoid.has(s.companyName.toLowerCase()))
    .map((s) => ({ signal: s, hits: keywordHits(icp, `${s.companyName} ${s.title} ${s.description ?? ""}`.toLowerCase()) }))
    .filter((s) => s.hits >= MIN_KEYWORD_HITS)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, MAX_CANDIDATES_PER_ORG)
    .map((s) => s.signal);
}

async function enrichCandidates(
  organization: { name: string; segment: string | null; city: string | null; state: string | null },
  icp: { productsSold: string[]; servicesSold: string[]; idealCustomerDescription: string | null },
  candidates: CandidateSignal[],
): Promise<z.infer<typeof MatchedOpportunitySchema>[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  const listText = candidates
    .map(
      (c, i) =>
        `${i}. Empresa: ${c.companyName} (${c.city ?? "?"}, ${c.state ?? "?"}) — Categoria: ${c.category} — ${c.title}${c.description ? ` — ${c.description}` : ""}`,
    )
    .join("\n");

  const client = new Anthropic({ apiKey });
  let response;
  try {
    response = await client.messages.parse({
      model: "claude-sonnet-5",
      max_tokens: 8000,
      output_config: { format: zodOutputFormat(MatchResultSchema) },
      messages: [
        {
          role: "user",
          content: `Você é um Diretor de Inteligência Comercial. A EMPRESA CONTRATANTE (quem vai abordar os prospects) é "${organization.name}" (${organization.segment ?? "segmento não informado"}, ${organization.city ?? "?"}/${organization.state ?? "?"}), que vende: ${[...icp.productsSold, ...icp.servicesSold].join(", ") || "não informado"}.${icp.idealCustomerDescription ? `\nCliente ideal: ${icp.idealCustomerDescription}` : ""}

Abaixo estão candidatos a oportunidade, já coletados de fontes públicas reais — NÃO pesquise nada, use só o que está escrito aqui. Para cada candidato que fizer sentido real como oportunidade comercial pra essa contratante, preencha o schema. Se um candidato não fizer sentido (não é fit real, ou a informação é fraca demais), simplesmente não o inclua na resposta — pode retornar uma lista menor, inclusive vazia. Nunca invente nome de decisor: decisionMakerName só se estiver claramente no texto, senão null.

CANDIDATOS:
${listText}`,
        },
      ],
    });
  } catch (err) {
    logError("free-signals: falha ao enriquecer candidatos", err, { organizationName: organization.name });
    return [];
  }

  return response.parsed_output?.opportunities ?? [];
}

// Casa os sinais recém-ingeridos (ingest.ts) contra o ICP de cada
// organização ativa e grava OpportunityScore — sem tocar em cota, crédito,
// cooldown ou SearchRun de ninguém (canal gratuito, conforme decidido).
export async function matchFreeSignalsToOrganizations(ingested: IngestedSignal[]): Promise<void> {
  if (ingested.length === 0) return;

  const signalRows = await prisma.signal.findMany({
    where: { id: { in: ingested.map((s) => s.signalId) } },
    include: { company: true },
  });
  const candidatePool: CandidateSignal[] = signalRows.map((s) => ({
    signalId: s.id,
    companyId: s.companyId,
    companyName: s.company.name,
    city: s.company.city,
    state: s.company.state,
    category: s.category,
    title: s.title,
    description: s.description,
  }));

  const organizations = await prismaAdmin.organization.findMany({
    include: { icps: { where: { isActive: true }, orderBy: { createdAt: "desc" }, take: 1 } },
  });

  for (const organization of organizations) {
    const icp = organization.icps[0];
    if (!icp) continue;
    if (isTrialExpired(organization.trialEndsAt)) continue;

    const { maxActiveOpportunities } = effectiveLimits(organization);
    if (maxActiveOpportunities !== null) {
      const activeCount = await prisma.opportunityScore.count({
        where: { organizationId: organization.id, stage: null, status: { not: "DISMISSED" } },
      });
      if (activeCount >= maxActiveOpportunities) continue;
    }

    const candidates = candidatesForIcp(icp, candidatePool);
    if (candidates.length === 0) continue;

    const enriched = await enrichCandidates(organization, icp, candidates);
    if (enriched.length === 0) continue;

    await withOrgContext(organization.id, async (tx) => {
      const mission = await tx.mission.create({ data: { organizationId: organization.id } });

      for (const opp of enriched) {
        const candidate = candidates[opp.candidateIndex];
        if (!candidate) continue;

        const score = await tx.opportunityScore.upsert({
          where: {
            organizationId_companyId_icpId: { organizationId: organization.id, companyId: candidate.companyId, icpId: icp.id },
          },
          update: {
            score: opp.score,
            urgency: opp.urgency,
            headline: opp.headline,
            execSummary: opp.execSummary,
            reasoning: opp.reasoning,
            buyerArea: opp.buyerArea,
            decisionMaker: opp.decisionMaker,
            decisionMakerName: opp.decisionMakerName ?? undefined,
            suggestedApproach: opp.approach,
            commercialArguments: opp.commercialArguments,
            objections: opp.objections,
            computedAt: new Date(),
            missionId: mission.id,
          },
          create: {
            organizationId: organization.id,
            companyId: candidate.companyId,
            icpId: icp.id,
            score: opp.score,
            urgency: opp.urgency,
            headline: opp.headline,
            execSummary: opp.execSummary,
            reasoning: opp.reasoning,
            buyerArea: opp.buyerArea,
            decisionMaker: opp.decisionMaker,
            decisionMakerName: opp.decisionMakerName,
            suggestedApproach: opp.approach,
            commercialArguments: opp.commercialArguments,
            objections: opp.objections,
            missionId: mission.id,
          },
        });

        await tx.opportunityScoreSignal.upsert({
          where: { opportunityScoreId_signalId: { opportunityScoreId: score.id, signalId: candidate.signalId } },
          update: {},
          create: { opportunityScoreId: score.id, signalId: candidate.signalId },
        });
      }
    });
  }
}
