import "server-only";
import { prisma } from "@/lib/prisma";
import { prismaAdmin } from "@/lib/prisma-admin";
import { findBestMatch } from "@/lib/opportunity-engine/company-matching";
import { fetchRssSignalCandidates } from "./rss-news";
import { extractCompanySignalsFromRss } from "./extract-rss-signals";
import { fetchPncpSignalCandidates, fetchPncpWinnersSignalCandidates } from "./pncp";
import { fetchBcbSignalCandidates, BCB_SOURCE_URL } from "./bcb";
import { fetchDecisionMakerByCnpj } from "./cnpj-enrichment";
import type { SignalCategory } from "@/generated/prisma/enums";

export type IngestedSignal = { signalId: string; companyId: string };

// Estados-alvo pra consulta do PNCP (que exige UF por chamada, não aceita
// "todos"). Deriva dos ICPs ativos de todo mundo; sem nenhum ICP com estado
// definido ainda (base zerada), cai numa lista curta dos estados mais
// relevantes economicamente pra não voltar vazio.
const FALLBACK_STATES = ["SP", "RJ", "MG", "PR", "RS", "SC", "BA"];

async function targetStates(): Promise<string[]> {
  const icps = await prismaAdmin.iCP.findMany({ where: { isActive: true }, select: { states: true } });
  const states = new Set<string>();
  for (const icp of icps) for (const uf of icp.states) states.add(uf.toUpperCase());
  return states.size > 0 ? [...states] : FALLBACK_STATES;
}

// Teto por execução — enriquecimento é 1 chamada externa por empresa, e
// isso já rodou uma vez de menos (o timeout de hoje) pra arriscar de novo
// sem limite. Lotes de 10 em paralelo em vez de sequencial, não pra
// paralelizar tudo de uma vez.
const MAX_DECISION_MAKER_ENRICHMENTS = 20;
const ENRICHMENT_BATCH_SIZE = 10;

// Grava o decisor achado via QSA da Receita (ver cnpj-enrichment.ts) no
// metadata da empresa — dado a mais pra eventualmente entrar no prompt da
// IA (src/lib/free-signals/match.ts), não substitui o que a IA já acha via
// busca na web. Só roda pra empresa privada com CNPJ completo (14 dígitos)
// — nem todo Company tem isso (Banco Central só dá a raiz de 8).
async function enrichNewCompaniesWithDecisionMaker(companies: { id: string; cnpj: string | null }[]): Promise<void> {
  const eligible = companies.filter((c) => c.cnpj?.length === 14).slice(0, MAX_DECISION_MAKER_ENRICHMENTS);
  for (let i = 0; i < eligible.length; i += ENRICHMENT_BATCH_SIZE) {
    const batch = eligible.slice(i, i + ENRICHMENT_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (c) => ({ id: c.id, info: await fetchDecisionMakerByCnpj(c.cnpj!) })),
    );
    for (const r of results) {
      if (!r.info) continue;
      await prismaAdmin.company.update({
        where: { id: r.id },
        data: { metadata: { decisionMakerName: r.info.name, decisionMakerRole: r.info.role, decisionMakerSource: "cnpj_qsa" } },
      });
    }
  }
}

// Coleta gratuita (RSS + PNCP) e grava como Company/Signal globais — sem
// custo de web_search, sem tocar em cota/crédito de nenhuma organização
// (essa etapa nem sabe quais organizações existem). O match por cliente
// acontece depois, em match.ts, só com o que foi criado/reaproveitado aqui.
export async function ingestFreeSignals(): Promise<IngestedSignal[]> {
  const states = await targetStates();

  const [rssItems, pncpItems, pncpWinnerItems, bcbItems] = await Promise.all([
    fetchRssSignalCandidates(),
    fetchPncpSignalCandidates(states),
    fetchPncpWinnersSignalCandidates(),
    fetchBcbSignalCandidates(),
  ]);
  const extractedRss = await extractCompanySignalsFromRss(rssItems);

  const result: IngestedSignal[] = [];

  // RSS: sem CNPJ, resolve por similaridade de nome — mesmo padrão já usado
  // pela busca por IA (company-matching.ts), pool carregado 1x por estado
  // envolvido e atualizado a cada criação nesta execução.
  const rssStates = [...new Set(extractedRss.map((s) => s.state).filter((s): s is string => Boolean(s)))];
  const rssCompanyPool = rssStates.length > 0 ? await prisma.company.findMany({ where: { state: { in: rssStates } } }) : [];

  for (const signal of extractedRss) {
    let company = findBestMatch(signal.companyName, signal.city, rssCompanyPool);
    if (!company) {
      company = await prisma.company.create({
        data: {
          name: signal.companyName,
          city: signal.city,
          state: signal.state,
          segment: signal.segment,
          cnpj: `unknown:${signal.companyName}:${signal.city ?? ""}:${Date.now()}`,
        },
      });
      rssCompanyPool.push(company);
    } else if (!company.segment && signal.segment) {
      // Empresa já existia sem segmento definido — só enriquece, nunca
      // sobrescreve um valor que já esteja preenchido por outra via.
      // prismaAdmin (não prisma): RLS pro papel restrito permite
      // INSERT/SELECT global em companies, mas não UPDATE — só o papel
      // admin (bypass) consegue gravar aqui, fora de contexto de org.
      company = await prismaAdmin.company.update({ where: { id: company.id }, data: { segment: signal.segment } });
      const idx = rssCompanyPool.findIndex((c) => c.id === company!.id);
      if (idx >= 0) rssCompanyPool[idx] = company;
    }

    const existing = await prisma.signal.findFirst({ where: { companyId: company.id, sourceUrl: signal.link } });
    const record =
      existing ??
      (await prisma.signal.create({
        data: {
          companyId: company.id,
          category: signal.category as SignalCategory,
          sourceType: "rss_free",
          sourceUrl: signal.link,
          title: signal.headline,
          description: signal.headline,
          detectedAt: signal.pubDate,
          confidence: 0.75,
          rawData: { sourceLabel: signal.sourceLabel },
        },
      }));
    result.push({ signalId: record.id, companyId: company.id });
  }

  // PNCP: CNPJ real do órgão comprador — dedup direto por CNPJ, sem
  // heurística de nome (muito mais confiável que o caminho do RSS).
  // prismaAdmin: mesmo motivo do ramo RSS acima — o branch "update" do
  // upsert (quando o órgão já existe de um edital anterior) precisa do
  // papel bypass, RLS restrito não permite UPDATE em companies.
  for (const item of pncpItems) {
    const company = await prismaAdmin.company.upsert({
      where: { cnpj: item.cnpj },
      update: {},
      create: {
        name: item.razaoSocial,
        cnpj: item.cnpj,
        city: item.municipioNome,
        state: item.ufSigla,
      },
    });

    const existing = await prisma.signal.findFirst({ where: { companyId: company.id, sourceUrl: item.sourceUrl } });
    const record =
      existing ??
      (await prisma.signal.create({
        data: {
          companyId: company.id,
          category: "PROCUREMENT",
          sourceType: "pncp_free",
          sourceUrl: item.sourceUrl,
          title: `Publicou edital: ${item.objetoCompra}`.slice(0, 200),
          description: item.valorTotalEstimado
            ? `${item.objetoCompra} — valor estimado R$ ${item.valorTotalEstimado.toLocaleString("pt-BR")}`
            : item.objetoCompra,
          detectedAt: item.dataPublicacaoPncp,
          confidence: 1.0,
          rawData: { numeroControlePNCP: item.numeroControlePNCP },
        },
      }));
    result.push({ signalId: record.id, companyId: company.id });
  }

  // PNCP vencedores: contrato já assinado com a empresa que venceu — sinal
  // de crescimento real dela, diferente do ramo acima (que é o anúncio do
  // edital, lado de quem compra). Volume alto o bastante (até ~250/dia,
  // validado ao vivo) pra valer o mesmo tratamento em lote do ramo BCB —
  // uma query por item já deu timeout uma vez hoje, não repete o erro.
  if (pncpWinnerItems.length > 0) {
    const winnerCnpjs = pncpWinnerItems.map((i) => i.cnpj);
    const existingWinnerCompanies = await prismaAdmin.company.findMany({ where: { cnpj: { in: winnerCnpjs } } });
    const existingWinnerCnpjs = new Set(existingWinnerCompanies.map((c) => c.cnpj));

    const seenWinnerCnpjs = new Set<string>();
    const newWinnerCompanyItems = pncpWinnerItems.filter((i) => {
      if (existingWinnerCnpjs.has(i.cnpj) || seenWinnerCnpjs.has(i.cnpj)) return false;
      seenWinnerCnpjs.add(i.cnpj);
      return true;
    });
    if (newWinnerCompanyItems.length > 0) {
      await prismaAdmin.company.createMany({
        data: newWinnerCompanyItems.map((i) => ({
          name: i.razaoSocial,
          cnpj: i.cnpj,
          city: i.municipioNome,
          state: i.ufSigla,
        })),
        skipDuplicates: true,
      });
    }

    const allWinnerCompanies = await prismaAdmin.company.findMany({ where: { cnpj: { in: winnerCnpjs } } });
    const winnerCompanyIdByCnpj = new Map(allWinnerCompanies.map((c) => [c.cnpj!, c.id]));
    const winnerCompanyIds = allWinnerCompanies.map((c) => c.id);

    // Decisor via CNPJ (QSA da Receita) só nas empresas privadas realmente
    // novas — reprocessar as já existentes todo dia seria chamada de API
    // externa desperdiçada pra dado que não muda de um dia pro outro. Teto
    // + lotes paralelos pelo mesmo motivo do resto deste arquivo: nunca
    // laço sequencial de chamada externa item a item.
    const newWinnerCompanies = allWinnerCompanies.filter((c) =>
      newWinnerCompanyItems.some((i) => i.cnpj === c.cnpj),
    );
    await enrichNewCompaniesWithDecisionMaker(newWinnerCompanies);

    const existingWinnerSignals = await prisma.signal.findMany({
      where: { companyId: { in: winnerCompanyIds } },
      select: { companyId: true, sourceUrl: true },
    });
    const existingWinnerKeys = new Set(existingWinnerSignals.map((s) => `${s.companyId}|${s.sourceUrl}`));

    const newWinnerSignalItems = pncpWinnerItems.filter((i) => {
      const companyId = winnerCompanyIdByCnpj.get(i.cnpj);
      return companyId && !existingWinnerKeys.has(`${companyId}|${i.sourceUrl}`);
    });
    if (newWinnerSignalItems.length > 0) {
      await prisma.signal.createMany({
        data: newWinnerSignalItems.map((i) => {
          const companyId = winnerCompanyIdByCnpj.get(i.cnpj)!;
          return {
            companyId,
            category: "AWARD",
            sourceType: "pncp_winner_free",
            sourceUrl: i.sourceUrl,
            title: `Venceu contrato público: ${i.objetoContrato}`.slice(0, 200),
            description: i.valorGlobal
              ? `Contrato com ${i.orgaoRazaoSocial} — valor R$ ${i.valorGlobal.toLocaleString("pt-BR")}. ${i.objetoContrato}`
              : `Contrato com ${i.orgaoRazaoSocial}. ${i.objetoContrato}`,
            detectedAt: i.dataAssinatura,
            confidence: 1.0,
            rawData: { numeroControlePNCP: i.numeroControlePNCP },
          };
        }),
      });
    }

    const allWinnerSignals = await prisma.signal.findMany({
      where: { companyId: { in: winnerCompanyIds }, sourceUrl: { in: pncpWinnerItems.map((i) => i.sourceUrl) } },
      select: { id: true, companyId: true },
    });
    for (const s of allWinnerSignals) result.push({ signalId: s.id, companyId: s.companyId });
  }

  // Banco Central: só a raiz do CNPJ (8 dígitos, validado com chamada real
  // à API antes de escrever isso — a lista não devolve o número completo).
  // Mesmo espírito do ramo PNCP acima (dedup por CNPJ, sinal criado só na
  // primeira vez que a raiz aparece — já dá "avisa quando é novo" de graça,
  // sem comparar contra uma lista do dia anterior), mas em lote: a lista do
  // BCB vem inteira a cada chamada (~700 itens, não só os novos do período
  // como no PNCP), então uma query por item estourava o tempo da função
  // serverless. Aqui são só ~5 queries no total, não ~700×3.
  if (bcbItems.length > 0) {
    const cnpjs = bcbItems.map((i) => i.cnpj);
    const existingCompanies = await prismaAdmin.company.findMany({ where: { cnpj: { in: cnpjs } } });
    const existingCnpjs = new Set(existingCompanies.map((c) => c.cnpj));

    const newItems = bcbItems.filter((i) => !existingCnpjs.has(i.cnpj));
    if (newItems.length > 0) {
      await prismaAdmin.company.createMany({
        data: newItems.map((i) => ({
          name: i.nomeInstituicao,
          cnpj: i.cnpj,
          city: i.municipio,
          state: i.uf,
          segment: i.segmento,
        })),
        skipDuplicates: true,
      });
    }

    // Recarrega tudo de uma vez (já existentes + recém-criadas) — dá o id
    // real de cada uma sem precisar de uma query por item.
    const allCompanies = await prismaAdmin.company.findMany({ where: { cnpj: { in: cnpjs } } });
    const companyIds = allCompanies.map((c) => c.id);

    const existingSignals = await prisma.signal.findMany({
      where: { companyId: { in: companyIds }, sourceUrl: BCB_SOURCE_URL },
      select: { companyId: true },
    });
    const companiesWithSignal = new Set(existingSignals.map((s) => s.companyId));
    const itemByCnpj = new Map(bcbItems.map((i) => [i.cnpj, i]));

    const newSignalCompanies = allCompanies.filter((c) => !companiesWithSignal.has(c.id));
    if (newSignalCompanies.length > 0) {
      await prisma.signal.createMany({
        data: newSignalCompanies.map((c) => {
          const item = itemByCnpj.get(c.cnpj!)!;
          return {
            companyId: c.id,
            category: "REGULATORY",
            sourceType: "bcb_free",
            sourceUrl: BCB_SOURCE_URL,
            title: `Autorizada pelo Banco Central: ${item.segmento}`.slice(0, 200),
            description: `${item.nomeInstituicao} consta como ${item.segmento} autorizada a funcionar pelo Banco Central.`,
            detectedAt: new Date(),
            confidence: 1.0,
            rawData: { segmento: item.segmento },
          };
        }),
      });
    }

    const allSignals = await prisma.signal.findMany({
      where: { companyId: { in: companyIds }, sourceUrl: BCB_SOURCE_URL },
      select: { id: true, companyId: true },
    });
    for (const s of allSignals) result.push({ signalId: s.id, companyId: s.companyId });
  }

  return result;
}
