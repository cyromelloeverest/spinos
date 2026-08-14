import "server-only";
import { prisma } from "@/lib/prisma";
import { prismaAdmin } from "@/lib/prisma-admin";
import { findBestMatch } from "@/lib/opportunity-engine/company-matching";
import { fetchRssSignalCandidates } from "./rss-news";
import { extractCompanySignalsFromRss } from "./extract-rss-signals";
import { fetchPncpSignalCandidates } from "./pncp";
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

// Coleta gratuita (RSS + PNCP) e grava como Company/Signal globais — sem
// custo de web_search, sem tocar em cota/crédito de nenhuma organização
// (essa etapa nem sabe quais organizações existem). O match por cliente
// acontece depois, em match.ts, só com o que foi criado/reaproveitado aqui.
export async function ingestFreeSignals(): Promise<IngestedSignal[]> {
  const states = await targetStates();

  const [rssItems, pncpItems] = await Promise.all([fetchRssSignalCandidates(), fetchPncpSignalCandidates(states)]);
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
      company = await prisma.company.update({ where: { id: company.id }, data: { segment: signal.segment } });
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
  for (const item of pncpItems) {
    const company = await prisma.company.upsert({
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

  return result;
}
