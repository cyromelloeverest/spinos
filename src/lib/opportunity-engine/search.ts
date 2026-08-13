"use server";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { prisma } from "@/lib/prisma";
import type { Organization, ICP } from "@/generated/prisma/client";
import { withOrgContext } from "@/lib/db/with-org-context";
import { OpportunitySearchResultSchema } from "./schema";
import { findBestMatch } from "./company-matching";
import { SEARCH_COOLDOWN_MS, EMPTY_RESULT_RETRY_MS, startOfCurrentMonth } from "./constants";
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
  | { status: "empty" }
  | { status: "ok"; count: number };

type OrgProfile = { name: string; segment: string | null; city: string | null; state: string | null };
type IcpProfile = {
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
};
type SearchPromptBuilder = (org: OrgProfile, icp: IcpProfile) => string;

// Página de resultado de busca (google.com/search?q=..., bing.com/search?...)
// não comprova nada sobre a empresa — é só o link da pergunta, não da
// resposta. Ver NO_FABRICATION_INSTRUCTION abaixo.
const SEARCH_ENGINE_RESULTS_URL = /^https?:\/\/(www\.)?(google|bing|duckduckgo)\.[a-z.]+\/search\b/i;
function isSearchEngineResultsUrl(url: string): boolean {
  return SEARCH_ENGINE_RESULTS_URL.test(url);
}

// Preços por token (USD) do modelo usado nas buscas hoje (claude-opus-5) —
// ajustar se o modelo mudar. Tokens de cache tratados pelo preço de input
// de propósito: cache write custa mais e cache read custa menos, mas a
// diferença é pequena perto do custo total e não vale a complexidade extra
// só pra essa estimativa (que já é mais precisa que o cálculo teórico
// anterior, por vir de uso real).
const OPUS_INPUT_PER_MTOK_USD = 5;
const OPUS_OUTPUT_PER_MTOK_USD = 25;
const WEB_SEARCH_PER_CALL_USD = 0.01;

// Grava o uso real de IA de toda busca que chegou a gerar uma resposta —
// nunca é apagado (diferente do SearchRun, que existe só pra contar cota e
// é apagado quando a busca não deve consumir o limite do cliente). É o
// dado que embasa validar/ajustar os números de plano (brief 2026-08-11,
// item 4 — antes só existia estimativa calculada, não custo medido). Nunca
// lança — instrumentação não pode derrubar uma busca que já funcionou.
async function logSearchUsage(
  organizationId: string,
  mode: "discovery" | "targeted",
  outcome: "ok" | "empty" | "parse_error",
  usage:
    | {
        input_tokens: number | null;
        output_tokens: number;
        cache_creation_input_tokens: number | null;
        cache_read_input_tokens: number | null;
        server_tool_use: { web_search_requests: number } | null;
      }
    | null
    | undefined,
): Promise<void> {
  // A API real sempre inclui usage — isso é só defensivo, pra instrumentação
  // nunca conseguir derrubar uma busca que já funcionou por completo.
  if (!usage) {
    logError("search: resposta sem usage, não deu pra logar custo", null, { organizationId, mode, outcome });
    return;
  }
  const inputTokens = usage.input_tokens ?? 0;
  const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
  const webSearchCount = usage.server_tool_use?.web_search_requests ?? 0;
  const estimatedCostUSD =
    ((inputTokens + cacheCreationTokens + cacheReadTokens) / 1_000_000) * OPUS_INPUT_PER_MTOK_USD +
    (usage.output_tokens / 1_000_000) * OPUS_OUTPUT_PER_MTOK_USD +
    webSearchCount * WEB_SEARCH_PER_CALL_USD;

  try {
    await withOrgContext(organizationId, (tx) =>
      tx.searchUsageLog.create({
        data: {
          organizationId,
          mode,
          outcome,
          inputTokens,
          outputTokens: usage.output_tokens,
          cacheCreationTokens,
          cacheReadTokens,
          webSearchCount,
          estimatedCostUSD,
        },
      }),
    );
  } catch (err) {
    logError("search: falha ao gravar log de uso de IA", err, { organizationId, mode, outcome });
  }
}

// Bloco de ICP compartilhado pelos dois modos de busca (aberta e dirigida)
// — o que muda entre eles é só a tarefa pedida antes/depois desse bloco.
function icpBlock(org: OrgProfile, icp: IcpProfile): string {
  const preferredSignalLabels = icp.preferredSignalCategories.map((c) => SIGNAL_CATEGORY_LABEL[c] ?? c);
  const saleModelLabel =
    icp.saleModel === "RECORRENTE" ? "recorrente/assinatura" : icp.saleModel === "PONTUAL" ? "pontual" : "não informado";

  return `EMPRESA CONTRATANTE (quem vai abordar os prospects):
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
${icp.idealCustomerDescription ? `- Descrição livre do cliente ideal (siga isso de perto, é a fonte mais confiável de nuance): ${icp.idealCustomerDescription}\n` : ""}${preferredSignalLabels.length > 0 ? `- Tipos de sinal mais relevantes pra essa empresa, priorize-os: ${preferredSignalLabels.join(", ")}\n` : ""}${icp.companiesToAvoid.length > 0 ? `- NÃO sugira estas empresas de jeito nenhum (já são clientes, concorrentes, ou já foram descartadas): ${icp.companiesToAvoid.join(", ")}\n` : ""}`;
}

const DECISION_MAKER_NAME_INSTRUCTION =
  'Pra cada oportunidade, tente também identificar o NOME REAL do provável decisor (não só o cargo) — procure em fontes públicas verificáveis como LinkedIn, a página "quem somos"/"equipe" do site da empresa, ou matérias de imprensa que citem a pessoa pelo nome. Preencha decisionMakerName só quando tiver certeza razoável da fonte; caso contrário, deixe null. Nunca invente um nome.';

// Regra central contra fabricação de fato — reforça o que os campos
// nullable do schema já permitem, porque um modelo sob pressão de
// "sempre preencher algo" tende a chutar um valor plausível em vez de
// admitir que não sabe (foi exatamente o que causou cidade errada numa
// busca dirigida real: a IA assumiu que a empresa ficava perto da
// contratante só porque bateria com o raio do ICP).
const NO_FABRICATION_INSTRUCTION =
  "Nunca afirme como fato algo que você não confirmou numa fonte pública real e específica (site oficial, LinkedIn, notícia, cadastro público, edital) — vale pra cidade, estado, porte/número de funcionários, tecnologia usada e qualquer outro dado factual. Sem confirmação real, deixe city/state null (nunca estime pela proximidade com a contratante ou porque bateria com o ICP) e, se mencionar porte/tamanho em execSummary ou reasoning, deixe explícito que é estimativa, não fato confirmado. Nunca use uma URL de página de resultado de busca (google.com/search, bing.com/search etc.) como sourceUrl de um sinal — só URLs de páginas de conteúdo real. Se não encontrar nenhuma fonte real específica, prefira sourceUrl null (ou deixar signals vazio) a inventar uma URL só pra preencher o campo.";

function buildDiscoveryPrompt(org: OrgProfile, icp: IcpProfile): string {
  return `Você é um Diretor de Inteligência Comercial. Sua tarefa é encontrar, usando busca na web, empresas reais com sinais públicos recentes de que estão iniciando um ciclo de compra que combina com o ICP abaixo.

${icpBlock(org, icp)}
Busque sinais públicos reais (notícias, vagas de emprego, editais, investimentos, expansões, mudanças de liderança) publicados recentemente. Para cada empresa candidata encontrada, preencha o schema com pelo menos uma fonte real (URL verificável) por sinal citado. Não invente sinais nem URLs. Priorize 3 a 6 oportunidades de alta qualidade em vez de uma lista longa e genérica.

Se, dentro dos critérios exatos de raio/cidades/estados/segmentos informados, você não encontrar nenhuma empresa real com sinal público verificável, AMPLIE a busca antes de desistir: considere cidades vizinhas, o estado inteiro, ou segmentos correlatos ao ICP. Deixe isso evidente no campo reasoning das oportunidades encontradas assim quando tiver ampliado o critério original. Só retorne uma lista vazia se, mesmo depois de ampliar, genuinamente não houver nenhuma evidência pública real — nunca invente uma empresa ou sinal só para preencher a lista.

${DECISION_MAKER_NAME_INSTRUCTION}

${NO_FABRICATION_INSTRUCTION}`;
}

// Busca dirigida: o cliente já tem uma empresa em mente (um lead que já
// está trabalhando fora do Spinos) e quer o mesmo tratamento completo —
// Spinos Score, argumentos, objeções — só que pra essa empresa específica,
// em vez de uma descoberta aberta.
function buildTargetedPrompt(companyName: string, location: string | null): SearchPromptBuilder {
  return (org, icp) => `Você é um Diretor de Inteligência Comercial. O cliente já tem uma empresa específica em mente — não é uma descoberta aberta, é uma análise dirigida sobre ELA.

${icpBlock(org, icp)}
EMPRESA-ALVO PRA ANALISAR (e só ela): ${companyName}${location ? ` — ${location}` : ""}

Pesquise sinais públicos reais e recentes sobre essa empresa específica (notícias, vagas de emprego, editais, investimentos, expansões, mudanças de liderança) e avalie se ela é uma oportunidade comercial real pra contratante, considerando o ICP acima. Preencha EXATAMENTE uma oportunidade no schema, sempre que confirmar que essa empresa existe de verdade — mesmo que não encontre nenhum sinal forte de ciclo de compra agora, preencha assim mesmo com um score mais baixo e um reasoning honesto explicando a ausência de sinais recentes (não deixe a lista vazia só por falta de sinal forte). Isso vale pra score/reasoning/approach, que são análise e recomendação, não fato — mas cidade, estado e porte SÓ entram se confirmados de verdade (ver regra abaixo). Só deixe a lista vazia se genuinamente não conseguir confirmar que essa empresa existe.

${DECISION_MAKER_NAME_INSTRUCTION}

${NO_FABRICATION_INSTRUCTION}`;
}

async function executeSearch(
  organizationId: string,
  buildSearchPrompt: SearchPromptBuilder,
  mode: "discovery" | "targeted",
): Promise<SearchOutcome> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { status: "not_configured" };
  }

  // Leituras de checagem (cooldown, ICP, limites de plano) — tudo dentro do
  // contexto da org, numa transação curta só de leitura.
  type PreCheck = { outcome: SearchOutcome } | { organization: Organization; icp: ICP; usedCredit: boolean };
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
    // "testando" o Enterprise, o teto do trial vale. Nenhum plano (incl.
    // Enterprise) tem dimensão ilimitada, então os tetos abaixo sempre
    // existem — não tem mais branch de "plano sem limite".
    const { maxActiveOpportunities, maxSearches, isTrialing } = effectiveLimits(organization);
    const activeCount = await tx.opportunityScore.count({
      where: { organizationId, stage: null, status: { not: "DISMISSED" } },
    });
    if (activeCount >= maxActiveOpportunities) {
      return { outcome: { status: "plan_limit", limit: maxActiveOpportunities } };
    }

    let usedCredit = false;
    // Trial é um teto total pros 7 dias inteiros, não "por mês" — a janela
    // de um mês não faz sentido pra um período que já é mais curto que isso.
    const searchesUsed = await tx.searchRun.count({
      where: isTrialing ? { organizationId } : { organizationId, createdAt: { gte: startOfCurrentMonth() } },
    });
    if (searchesUsed >= maxSearches) {
      // Enterprise pago (fora de trial) nunca usa saldo pré-pago — acima do
      // teto incluso é conversa comercial, não compra automática (ver
      // brief 2026-08-11). Trial "testando" Enterprise continua podendo
      // usar crédito normalmente — o teto ali é sempre o do trial, nunca o
      // do plano selecionado. Consome 1 crédito na mesma transação da
      // checagem, pra duplo-clique não gastar 2 créditos numa corrida.
      const creditAllowed = isTrialing || organization.plan !== "ENTERPRISE";
      if (creditAllowed && organization.searchCreditBalance > 0) {
        await tx.organization.update({
          where: { id: organizationId },
          data: { searchCreditBalance: { decrement: 1 } },
        });
        usedCredit = true;
      } else {
        return { outcome: { status: "search_limit", limit: maxSearches } };
      }
    }

    return { organization, icp, usedCredit };
  });

  if ("outcome" in preCheck) return preCheck.outcome;
  const { organization, icp, usedCredit } = preCheck;

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
      messages: [{ role: "user", content: buildSearchPrompt(organization, icp) }],
    });
  } catch (err) {
    // A busca falhou antes de produzir resultado — não deve consumir o
    // limite de 1 busca a cada 2 dias nem o limite de buscas/mês, então
    // desfazemos os dois registros acima.
    await withOrgContext(organizationId, async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        // Devolve o crédito pré-pago também, se essa busca tinha consumido
        // um — ela não produziu resultado nenhum, não é justo cobrar por isso.
        data: { lastSearchAt: previousLastSearchAt, searchCreditBalance: usedCredit ? { increment: 1 } : undefined },
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
    await logSearchUsage(organizationId, mode, "parse_error", response.usage);
    await withOrgContext(organizationId, async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: { lastSearchAt: previousLastSearchAt, searchCreditBalance: usedCredit ? { increment: 1 } : undefined },
      });
      await tx.searchRun.delete({ where: { id: searchRun.id } }).catch(() => {});
    });
    return { status: "error", message: "A IA não retornou um resultado estruturado válido." };
  }

  // Defesa em profundidade além da instrução no prompt: mesmo com
  // NO_FABRICATION_INSTRUCTION, um modelo eventualmente ainda devolve o
  // link de uma página de resultado de busca como se fosse uma fonte real
  // (foi o que causou o "sinal" fantasma da Furnax, com google.com/search
  // como sourceUrl). Descarta esses sinais aqui em vez de confiar só no
  // prompt — a oportunidade em si continua valendo, só perde esse sinal.
  const opportunities = response.parsed_output.opportunities.map((opp) => ({
    ...opp,
    signals: opp.signals.filter((s) => !s.sourceUrl || !isSearchEngineResultsUrl(s.sourceUrl)),
  }));

  if (opportunities.length === 0) {
    // Busca válida, mas sem nenhuma oportunidade real encontrada — o
    // cliente não recebeu valor nenhum desta execução, então não deve
    // consumir a cota mensal/trial nem o cooldown inteiro de 2 dias.
    // Reduz o cooldown pra um retry bem mais rápido em vez disso. O custo
    // real de IA foi incorrido de qualquer jeito — loga antes de apagar o
    // SearchRun (esse log nunca é apagado, ver logSearchUsage acima).
    await logSearchUsage(organizationId, mode, "empty", response.usage);
    await withOrgContext(organizationId, async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: {
          lastSearchAt: new Date(runTimestamp.getTime() - SEARCH_COOLDOWN_MS + EMPTY_RESULT_RETRY_MS),
          searchCreditBalance: usedCredit ? { increment: 1 } : undefined,
        },
      });
      await tx.searchRun.delete({ where: { id: searchRun.id } }).catch(() => {});
    });
    return { status: "empty" };
  }

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
  // .filter(Boolean) tira o null de opp.state não-confirmado — sem isso,
  // o "in" do Prisma recebe um null solto na lista, que não é o mesmo que
  // buscar linhas com state null (e algumas versões do driver rejeitam).
  const knownStates = [...new Set(opportunities.map((o) => o.state).filter((s): s is string => Boolean(s)))];
  const companyPool = knownStates.length > 0 ? await prisma.company.findMany({ where: { state: { in: knownStates } } }) : [];

  // Uma missão por execução de busca — agrupa as oportunidades encontradas
  // agora pra o Dashboard destacar "o resultado desta busca" como um todo.
  // opportunities.length nunca é 0 aqui (busca vazia já retornou acima).
  const mission = await withOrgContext(organizationId, (tx) => tx.mission.create({ data: { organizationId } }));

  for (const opp of opportunities) {
    let company = findBestMatch(opp.companyName, opp.city, companyPool);

    if (!company) {
      company = await prisma.company.create({
        data: {
          name: opp.companyName,
          city: opp.city,
          state: opp.state,
          cnpj: `unknown:${opp.companyName}:${opp.city ?? ""}:${Date.now()}`,
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
          missionId: mission.id,
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
          missionId: mission.id,
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

  await logSearchUsage(organizationId, mode, "ok", response.usage);
  return { status: "ok", count: opportunities.length };
}

// Descoberta aberta — acha empresas novas que combinam com o ICP.
export async function searchOpportunities(organizationId: string): Promise<SearchOutcome> {
  return executeSearch(organizationId, buildDiscoveryPrompt, "discovery");
}

// Busca dirigida — o cliente já tem uma empresa em mente e quer o Spinos
// Score completo dela. Mesmo motor, mesma cota/cooldown/crédito de
// executeSearch, só muda o prompt.
export async function searchSpecificCompany(
  organizationId: string,
  companyName: string,
  location: string | null,
): Promise<SearchOutcome> {
  return executeSearch(organizationId, buildTargetedPrompt(companyName, location), "targeted");
}
