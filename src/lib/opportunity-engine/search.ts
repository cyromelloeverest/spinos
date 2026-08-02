"use server";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { prisma } from "@/lib/prisma";
import { OpportunitySearchResultSchema } from "./schema";
import { findBestMatch } from "./company-matching";
import { SEARCH_COOLDOWN_MS } from "./constants";
import { SIGNAL_CATEGORY_LABEL } from "@/lib/signal-categories";

export type SearchOutcome =
  | { status: "not_configured" }
  | { status: "error"; message: string }
  | { status: "rate_limited"; nextAvailableAt: string }
  | { status: "ok"; count: number };

function buildPrompt(org: {
  name: string;
  segment: string | null;
  city: string | null;
  state: string | null;
}, icp: {
  segments: string[];
  radiusKm: number | null;
  states: string[];
  cities: string[];
  decisionMakerTitles: string[];
  technologies: string[];
  keywords: string[];
  productsSold: string[];
  servicesSold: string[];
  idealCustomerDescription: string | null;
  preferredSignalCategories: string[];
  companiesToAvoid: string[];
}) {
  const preferredSignalLabels = icp.preferredSignalCategories.map((c) => SIGNAL_CATEGORY_LABEL[c] ?? c);

  return `Você é um Diretor de Inteligência Comercial. Sua tarefa é encontrar, usando busca na web, empresas reais com sinais públicos recentes de que estão iniciando um ciclo de compra que combina com o ICP abaixo.

EMPRESA CONTRATANTE (quem vai abordar os prospects):
- Nome: ${org.name}
- Segmento: ${org.segment ?? "não informado"}
- Localização: ${org.city ?? "?"}, ${org.state ?? "?"}

ICP (perfil de cliente ideal):
- Segmentos-alvo: ${icp.segments.join(", ") || "qualquer"}
- Raio de atuação: ${icp.radiusKm ? `${icp.radiusKm}km` : "não restrito"}
- Estados: ${icp.states.join(", ") || "qualquer"}
- Cidades prioritárias: ${icp.cities.join(", ") || "qualquer"}
- Cargos decisores: ${icp.decisionMakerTitles.join(", ") || "não informado"}
- Tecnologias relevantes: ${icp.technologies.join(", ") || "não informado"}
- Palavras-chave: ${icp.keywords.join(", ") || "não informado"}
- Produtos vendidos pela contratante: ${icp.productsSold.join(", ") || "não informado"}
- Serviços vendidos pela contratante: ${icp.servicesSold.join(", ") || "não informado"}
${icp.idealCustomerDescription ? `- Descrição livre do cliente ideal (siga isso de perto, é a fonte mais confiável de nuance): ${icp.idealCustomerDescription}\n` : ""}${preferredSignalLabels.length > 0 ? `- Tipos de sinal mais relevantes pra essa empresa, priorize-os: ${preferredSignalLabels.join(", ")}\n` : ""}${icp.companiesToAvoid.length > 0 ? `- NÃO sugira estas empresas de jeito nenhum (já são clientes, concorrentes, ou já foram descartadas): ${icp.companiesToAvoid.join(", ")}\n` : ""}
Busque sinais públicos reais (notícias, vagas de emprego, editais, investimentos, expansões, mudanças de liderança) publicados recentemente. Para cada empresa candidata encontrada, preencha o schema com pelo menos uma fonte real (URL verificável) por sinal citado. Não invente sinais nem URLs. Priorize 3 a 6 oportunidades de alta qualidade em vez de uma lista longa e genérica.`;
}

export async function searchOpportunities(organizationId: string): Promise<SearchOutcome> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { status: "not_configured" };
  }

  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) {
    return { status: "error", message: "Organização não encontrada." };
  }

  if (organization.lastSearchAt) {
    const nextAvailableAt = new Date(organization.lastSearchAt.getTime() + SEARCH_COOLDOWN_MS);
    if (nextAvailableAt.getTime() > Date.now()) {
      return { status: "rate_limited", nextAvailableAt: nextAvailableAt.toISOString() };
    }
  }

  const icp = await prisma.iCP.findFirst({
    where: { organizationId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  if (!icp) {
    return { status: "error", message: "Cadastre um ICP antes de buscar oportunidades." };
  }

  const runTimestamp = new Date();
  const previousLastSearchAt = organization.lastSearchAt;

  // Grava o horário já aqui, antes de chamar a IA — evita que um segundo
  // clique durante os 30-90s de espera dispare outra busca (e outro custo).
  await prisma.organization.update({
    where: { id: organizationId },
    data: { lastSearchAt: runTimestamp },
  });

  const client = new Anthropic({ apiKey });

  let response;
  try {
    response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 10 }],
      output_config: {
        format: zodOutputFormat(OpportunitySearchResultSchema),
      },
      messages: [{ role: "user", content: buildPrompt(organization, icp) }],
    });
  } catch (err) {
    // A busca falhou antes de produzir resultado — não deve consumir o
    // limite de 1 busca a cada 2 dias, então desfazemos o registro acima.
    await prisma.organization.update({
      where: { id: organizationId },
      data: { lastSearchAt: previousLastSearchAt },
    });
    const message = err instanceof Anthropic.APIError ? err.message : "Erro inesperado ao chamar a IA.";
    return { status: "error", message: `Busca falhou: ${message}` };
  }

  if (!response.parsed_output) {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { lastSearchAt: previousLastSearchAt },
    });
    return { status: "error", message: "A IA não retornou um resultado estruturado válido." };
  }

  const { opportunities } = response.parsed_output;

  // Pool em memória de empresas candidatas a match — carregado uma vez e
  // atualizado a cada criação nesta execução, para que candidatas repetidas
  // dentro do mesmo batch (não só entre execuções) também sejam mescladas.
  const companyPool = await prisma.company.findMany({
    where: { state: { in: [...new Set(opportunities.map((o) => o.state))] } },
  });

  for (const opp of opportunities) {
    let company = findBestMatch(opp.companyName, opp.city, companyPool);

    if (!company) {
      company = await prisma.company.create({
        data: {
          name: opp.companyName,
          city: opp.city,
          state: opp.state,
          cnpj: `unknown:${opp.companyName}:${opp.city}:${Date.now()}`,
        },
      });
      companyPool.push(company);
    }

    const score = await prisma.opportunityScore.upsert({
      where: {
        organizationId_companyId_icpId: {
          organizationId,
          companyId: company.id,
          icpId: icp.id,
        },
      },
      update: {
        score: opp.score,
        urgency: opp.urgency,
        headline: opp.headline,
        execSummary: opp.execSummary,
        reasoning: opp.reasoning,
        buyerArea: opp.buyerArea,
        decisionMaker: opp.decisionMaker,
        suggestedApproach: opp.approach,
        commercialArguments: opp.commercialArguments,
        objections: opp.objections,
        computedAt: runTimestamp,
      },
      create: {
        organizationId,
        companyId: company.id,
        icpId: icp.id,
        score: opp.score,
        urgency: opp.urgency,
        headline: opp.headline,
        execSummary: opp.execSummary,
        reasoning: opp.reasoning,
        buyerArea: opp.buyerArea,
        decisionMaker: opp.decisionMaker,
        suggestedApproach: opp.approach,
        commercialArguments: opp.commercialArguments,
        objections: opp.objections,
        computedAt: runTimestamp,
      },
    });

    for (const signal of opp.signals) {
      const created = await prisma.signal.create({
        data: {
          companyId: company.id,
          category: signal.category,
          sourceType: "ai_web_search",
          sourceUrl: signal.sourceUrl,
          title: SIGNAL_CATEGORY_LABEL[signal.category] ?? signal.category,
          description: signal.text,
          detectedAt: runTimestamp,
        },
      });
      await prisma.opportunityScoreSignal.create({
        data: { opportunityScoreId: score.id, signalId: created.id },
      });
    }
  }

  return { status: "ok", count: opportunities.length };
}
