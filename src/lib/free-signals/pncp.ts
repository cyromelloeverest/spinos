import "server-only";
import { logError } from "@/lib/log-error";

export type PncpItem = {
  cnpj: string;
  razaoSocial: string;
  municipioNome: string | null;
  ufSigla: string | null;
  objetoCompra: string;
  valorTotalEstimado: number | null;
  dataPublicacaoPncp: Date;
  sourceUrl: string;
  numeroControlePNCP: string;
};

// Pregão Eletrônico é, disparado, a modalidade mais comum de compra pública
// no Brasil — escopo inicial da Fase 1. Dá pra somar outras modalidades
// depois (a API aceita um código por chamada, não uma lista).
const MODALIDADE_PREGAO_ELETRONICO = 6;
const LOOKBACK_DAYS = 3;
const FETCH_TIMEOUT_MS = 10_000;

function toYYYYMMDD(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

type PncpApiItem = {
  orgaoEntidade?: { cnpj?: string; razaoSocial?: string };
  unidadeOrgao?: { municipioNome?: string; ufSigla?: string };
  objetoCompra?: string;
  valorTotalEstimado?: number | null;
  dataPublicacaoPncp?: string;
  linkSistemaOrigem?: string;
  numeroControlePNCP?: string;
  anoCompra?: number;
  sequencialCompra?: number;
};

// API pública de consulta do PNCP (Portal Nacional de Contratações
// Públicas, Lei 14.133/2021) — sem autenticação, sem custo, unifica
// licitações federais/estaduais/municipais. Documentação:
// https://pncp.gov.br/api/consulta/swagger-ui/index.html
export async function fetchPncpSignalCandidates(states: string[]): Promise<PncpItem[]> {
  if (states.length === 0) return [];

  const dataFinal = new Date();
  const dataInicial = new Date(dataFinal.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const all: PncpItem[] = [];

  for (const uf of states) {
    const url = new URL("https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao");
    url.searchParams.set("dataInicial", toYYYYMMDD(dataInicial));
    url.searchParams.set("dataFinal", toYYYYMMDD(dataFinal));
    url.searchParams.set("codigoModalidadeContratacao", String(MODALIDADE_PREGAO_ELETRONICO));
    url.searchParams.set("uf", uf.toUpperCase());
    url.searchParams.set("pagina", "1");
    url.searchParams.set("tamanhoPagina", "20");

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) continue;
      const json = (await res.json()) as { data?: PncpApiItem[] };
      for (const item of json.data ?? []) {
        const cnpj = item.orgaoEntidade?.cnpj;
        if (!cnpj || !item.objetoCompra || !item.dataPublicacaoPncp) continue;
        all.push({
          cnpj,
          razaoSocial: item.orgaoEntidade?.razaoSocial ?? cnpj,
          municipioNome: item.unidadeOrgao?.municipioNome ?? null,
          ufSigla: item.unidadeOrgao?.ufSigla ?? uf.toUpperCase(),
          objetoCompra: item.objetoCompra,
          valorTotalEstimado: item.valorTotalEstimado ?? null,
          dataPublicacaoPncp: new Date(item.dataPublicacaoPncp),
          sourceUrl:
            item.linkSistemaOrigem ||
            `https://pncp.gov.br/app/editais/${cnpj}/${item.anoCompra}/${item.sequencialCompra}`,
          numeroControlePNCP: item.numeroControlePNCP ?? `${cnpj}-${item.anoCompra}-${item.sequencialCompra}`,
        });
      }
    } catch (err) {
      logError("free-signals: falha ao buscar PNCP", err, { uf });
    }
  }

  return all;
}
