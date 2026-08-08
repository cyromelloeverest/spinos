"use server";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { prisma } from "@/lib/prisma";
import type { Organization, ICP } from "@/generated/prisma/client";
import { withOrgContext } from "@/lib/db/with-org-context";
import { OpportunitySearchResultSchema } from "./schema";
import { findBestMatch } from "./company-matching";
import { SEARCH_COOLDOWN_MS, startOfCurrentMonth } from "./constants";
import { SIGNAL_CATEGORY_LABEL } from "@/lib/signal-categories";
import { effectiveLimits } from "@/lib/trial";
import { fetchOgImage } from "@/lib/og-image";
import { logError } from "@/lib/log-error";

export type SearchOutcome =
  | { status: "not_configured" }
  | { status: "error"; message: string }
  | { status: "rate_limited"; nextAvailableAt: string }
  | { status: "plan_limit"; limit: number }
  | { status: "search_limit"; limit: number }
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
  averageTicketBRL: number | null;
  salesCycleLength: string | null;
  saleModel: string | null;
  idealCustomerDescription: string | null;
  preferredSignalCategories: string[];
  companiesToAvoid: string[];
}) {
  const preferredSignalLabels = icp.preferredSignalCategories.map((c) => SIGNAL_CATEGORY_LABEL[c] ?? c);
  const saleModelLabel =
    icp.saleModel === "RECORRENTE" ? "recorrente/assinatura" : icp.saleModel === "PONTUAL" ? "pontual" : "não informado";

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
- Ticket médio de venda da contratante: ${icp.averageTicketBRL ? `R$ ${icp.averageTicketBRL.toLocaleString("pt-BR")}` : "não informado"} — use isso pra calibrar se o porte do prospect é compatível (nem pequeno demais pra pagar, nem tão grande que o ticket vira irrelevante)
- Ciclo de vendas típico da contratante: ${icp.salesCycleLength || "não informado"} — use isso como referência ao estimar a janela de urgência de cada oportunidade
- Modelo de venda da contratante: ${saleModelLabel}
${icp.idealCustomerDescription ? `- Descrição livre do cliente ideal (siga isso de perto, é a fonte mais confiável de nuance): ${icp.idealCustomerDescription}\n` : ""}${preferredSignalLabels.length > 0 ? `- Tipos de sinal mais relevantes pra essa empresa, priorize-os: ${preferredSignalLabels.join(", ")}\n` : ""}${icp.companiesToAvoid.length > 0 ? `- NÃO sugira estas empresas de jeito nenhum (já são clientes, concorrentes, ou já foram descartadas): ${icp.companiesToAvoid.join(", ")}\n` : ""}
Busque sinais públicos reais (notícias, vagas de emprego, editais, investimentos, expansões, mudanças de liderança) publicados recentemente. Para cada empresa candidata encontrada, preencha o schema com pelo menos uma fonte real (URL verificável) por sinal citado. Não invente sinais nem URLs. Priorize 3 a 6 oportunidades de alta qualidade em vez de uma lista longa e genérica.

Pra cada oportunidade, tente também identificar o NOME REAL do provável decisor (não só o cargo) — procure em fontes públicas verificáveis como LinkedIn, a página "quem somos"/"equipe" do site da empresa, ou matérias de imprensa que citem a pessoa pelo nome. Preencha decisionMakerName só quando tiver certeza razoável da fonte; caso contrário, deixe null. Nunca invente um nome.`;
}

export async function searchOpportunities(organizationId: string): Promise<SearchOutcome> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { status: "not_configured" };
  }

  // Leituras de checagem (cooldown, ICP, limites de plano) — tudo dentro do
  // contexto da org, numa transação curta só de leitura.
  type PreCheck = { outcome: SearchOutcome } | { organization: Organization; icp: ICP };
  const preCheck = await withOrgContext(organizationId, async (tx): Promise<PreCheck> => {
    const organization = await tx.organization.findUnique({ where: { id: organizationId } });
    if (!organization) return { outcome: { status: "error", message: "Organização não encontrada." } };

    if (organization.lastSearchAt) {
      const nextAvailableAt = new Date(organization.lastSearchAt.getTime() + SEARCH_COOLDOWN_MS);
      if (nextAvailableAt.getTime() > Date.now()) {
        return { outcome: { status: "rate_limited", nextAvailableAt: nextAvailableAt.toISOString() } };
      }
    }

    const icp = await tx.iCP.findFirst({
      where: { organizationId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    if (!icp) return { outcome: { status: "error", message: "Cadastre um ICP antes de buscar oportunidades." } };

    // Trial nunca herda o limite do plano selecionado pra testar — mesmo
    // "testando" o Enterprise (limites ilimitados), o teto do trial vale.
    const { maxActiveOpportunities, maxSearches, isTrialing } = effectiveLimits(organization);
    if (maxActiveOpportunities !== null) {
      const activeCount = await tx.opportunityScore.count({
        where: { organizationId, stage: null, status: { not: "DISMISSED" } },
      });
      if (activeCount >= maxActiveOpportunities) {
        return { outcome: { status: "plan_limit", limit: maxActiveOpportunities } };
      }
    }

    if (maxSearches !== null) {
      // Trial é um teto total pros 7 dias inteiros, não "por mês" — a janela
      // de um mês não faz sentido pra um período que já é mais curto que isso.
      const searchesUsed = await tx.searchRun.count({
        where: isTrialing ? { organizationId } : { organizationId, createdAt: { gte: startOfCurrentMonth() } },
      });
      if (searchesUsed >= maxSearches) {
        return { outcome: { status: "search_limit", limit: maxSearches } };
      }
    }

    return { organization, icp };
  });

  if ("outcome" in preCheck) return preCheck.outcome;
  const { organization, icp } = preCheck;

  const runTimestamp = new Date();
  const previousLastSearchAt = organization.lastSearchAt;

  // Grava o horário já aqui, antes de chamar a IA — evita que um segundo
  // clique durante os 30-90s de espera dispare outra busca (e outro custo).
  // Transação curta e separada da chamada à IA de propósito: não dá pra
  // segurar uma transação do Postgres aberta por 30-90s esperando rede.
  const searchRun = await withOrgContext(organizationId, async (tx) => {
    await tx.organization.update({
      where: { id: organizationId },
      data: { lastSearchAt: runTimestamp },
    });
    return tx.searchRun.create({ data: { organizationId } });
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
    // limite de 1 busca a cada 2 dias nem o limite de buscas/mês, então
    // desfazemos os dois registros acima.
    await withOrgContext(organizationId, async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: { lastSearchAt: previousLastSearchAt },
      });
      await tx.searchRun.delete({ where: { id: searchRun.id } }).catch(() => {});
    });
    // Não repassa err.message pro cliente (OWASP A10) — mensagem da API da
    // Anthropic pode conter detalhe interno (ex: "credit balance too low",
    // que é estado de billing nosso, não do cliente). Log fica só no server.
    logError("search: falha ao chamar a IA", err, { organizationId });
    return { status: "error", message: "Não foi possível completar a busca agora. Tente novamente em instantes." };
  }

  if (!response.parsed_output) {
    await withOrgContext(organizationId, async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: { lastSearchAt: previousLastSearchAt },
      });
      await tx.searchRun.delete({ where: { id: searchRun.id } }).catch(() => {});
    });
    return { status: "error", message: "A IA não retornou um resultado estruturado válido." };
  }

  const { opportunities } = response.parsed_output;

  // Busca o og:image de cada fonte em paralelo antes de criar qualquer
  // registro — uma única onda de fetches (com timeout curto cada) em vez de
  // N chamadas sequenciais, e deduplicada por URL. Puro scraping de
  // metadado, sem custo de IA; falha de uma fonte nunca derruba a busca.
  const uniqueSourceUrls = [...new Set(opportunities.flatMap((o) => o.signals.map((s) => s.sourceUrl)).filter(Boolean))];
  const imageUrlBySource = new Map(
    await Promise.all(uniqueSourceUrls.map(async (url) => [url, await fetchOgImage(url)] as const)),
  );

  // Company/Signal são tabelas globais (fato objetivo, não pertence a um
  // tenant) — usam o client normal direto, sem contexto de org: a policy
  // delas libera leitura/escrita pra qualquer conexão, não filtra por
  // organizationId (não existe essa coluna nelas).
  const companyPool = await prisma.company.findMany({
    where: { state: { in: [...new Set(opportunities.map((o) => o.state))] } },
  });

  // Uma missão por execução de busca — agrupa as oportunidades encontradas
  // agora pra o Dashboard destacar "o resultado desta busca" como um todo.
  const mission =
    opportunities.length > 0
      ? await withOrgContext(organizationId, (tx) => tx.mission.create({ data: { organizationId } }))
      : null;

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

    // Resolve os sinais (tabela global) fora do contexto de org, igual à
    // company acima.
    const signalRecords = await Promise.all(
      opp.signals.map(async (signal) => {
        // Reaproveita um sinal já existente pra mesma empresa+fonte em vez de
        // recriar — sem isso, uma notícia que continua "no ar" entre buscas
        // virava um card duplicado no Radar a cada execução.
        const existingSignal = await prisma.signal.findFirst({
          where: { companyId: company.id, sourceUrl: signal.sourceUrl },
        });
        return (
          existingSignal ??
          (await prisma.signal.create({
            data: {
              companyId: company.id,
              category: signal.category,
              sourceType: "ai_web_search",
              sourceUrl: signal.sourceUrl,
              imageUrl: imageUrlBySource.get(signal.sourceUrl) ?? null,
              title: SIGNAL_CATEGORY_LABEL[signal.category] ?? signal.category,
              description: signal.text,
              detectedAt: runTimestamp,
            },
          }))
        );
      }),
    );

    // O OpportunityScore e seus vínculos com Signal são dado de tenant — de
    // volta ao contexto de org, numa transação curta por oportunidade.
    await withOrgContext(organizationId, async (tx) => {
      const score = await tx.opportunityScore.upsert({
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
          // undefined (não null) quando a IA não achou nome dessa vez — Prisma
          // ignora o campo no update, preservando um nome já achado antes em
          // vez de apagar informação boa por causa de uma busca menos sortuda.
          decisionMakerName: opp.decisionMakerName ?? undefined,
          suggestedApproach: opp.approach,
          commercialArguments: opp.commercialArguments,
          objections: opp.objections,
          computedAt: runTimestamp,
          missionId: mission?.id,
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
          decisionMakerName: opp.decisionMakerName,
          suggestedApproach: opp.approach,
          commercialArguments: opp.commercialArguments,
          objections: opp.objections,
          computedAt: runTimestamp,
          missionId: mission?.id,
        },
      });

      for (const signalRecord of signalRecords) {
        await tx.opportunityScoreSignal.upsert({
          where: { opportunityScoreId_signalId: { opportunityScoreId: score.id, signalId: signalRecord.id } },
          update: {},
          create: { opportunityScoreId: score.id, signalId: signalRecord.id },
        });
      }
    });
  }

  return { status: "ok", count: opportunities.length };
}
