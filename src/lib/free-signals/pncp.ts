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

export type PncpWinnerItem = {
  cnpj: string;
  razaoSocial: string;
  orgaoRazaoSocial: string;
  municipioNome: string | null;
  ufSigla: string | null;
  objetoContrato: string;
  valorGlobal: number | null;
  dataAssinatura: Date;
  sourceUrl: string;
  numeroControlePNCP: string;
};

// Lado vencedor da licitação — diferente do ramo acima (que é o anúncio do
// edital, lado de quem compra). Aqui é o contrato já assinado: sinal de
// crescimento real da empresa que venceu, não só "o governo quer comprar
// algo". Endpoint não pede UF (devolve nacional numa chamada só, mais
// simples que o ramo de editais). Volume é bem maior (milhares/dia
// nacionalmente) — por isso 1 dia de janela + teto de páginas, escopo
// inicial deliberadamente incompleto (mesmo espírito do MODALIDADE_
// PREGAO_ELETRONICO acima), dá pra ampliar depois.
const WINNERS_LOOKBACK_DAYS = 1;
const WINNERS_MAX_PAGES = 5;
const WINNERS_PAGE_SIZE = 50;

type PncpContratoApiItem = {
  niFornecedor?: string;
  tipoPessoa?: string;
  nomeRazaoSocialFornecedor?: string;
  orgaoEntidade?: { cnpj?: string; razaoSocial?: string };
  unidadeOrgao?: { municipioNome?: string; ufSigla?: string };
  objetoContrato?: string;
  valorGlobal?: number | null;
  dataAssinatura?: string;
  numeroControlePNCP?: string;
  anoContrato?: number;
  sequencialContrato?: number;
};

export async function fetchPncpWinnersSignalCandidates(): Promise<PncpWinnerItem[]> {
  const dataFinal = new Date();
  const dataInicial = new Date(dataFinal.getTime() - WINNERS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const all: PncpWinnerItem[] = [];

  for (let pagina = 1; pagina <= WINNERS_MAX_PAGES; pagina++) {
    const url = new URL("https://pncp.gov.br/api/consulta/v1/contratos");
    url.searchParams.set("dataInicial", toYYYYMMDD(dataInicial));
    url.searchParams.set("dataFinal", toYYYYMMDD(dataFinal));
    url.searchParams.set("pagina", String(pagina));
    url.searchParams.set("tamanhoPagina", String(WINNERS_PAGE_SIZE));

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) break;
      const json = (await res.json()) as { data?: PncpContratoApiItem[]; paginasRestantes?: number };
      const items = json.data ?? [];
      if (items.length === 0) break;

      for (const item of items) {
        if (item.tipoPessoa !== "PJ") continue; // só empresa, não pessoa física
        const cnpj = item.niFornecedor;
        const orgaoCnpj = item.orgaoEntidade?.cnpj;
        if (!cnpj || !orgaoCnpj || !item.objetoContrato || !item.dataAssinatura) continue;
        all.push({
          cnpj,
          razaoSocial: item.nomeRazaoSocialFornecedor ?? cnpj,
          orgaoRazaoSocial: item.orgaoEntidade?.razaoSocial ?? "",
          municipioNome: item.unidadeOrgao?.municipioNome ?? null,
          ufSigla: item.unidadeOrgao?.ufSigla ?? null,
          objetoContrato: item.objetoContrato,
          valorGlobal: item.valorGlobal ?? null,
          dataAssinatura: new Date(item.dataAssinatura),
          sourceUrl: `https://pncp.gov.br/app/contratos/${orgaoCnpj}/${item.anoContrato}/${item.sequencialContrato}`,
          numeroControlePNCP: item.numeroControlePNCP ?? `${orgaoCnpj}-${item.anoContrato}-${item.sequencialContrato}`,
        });
      }

      if (!json.paginasRestantes || json.paginasRestantes <= 0) break;
    } catch (err) {
      logError("free-signals: falha ao buscar vencedores PNCP", err, { pagina });
      break;
    }
  }

  return all;
}
