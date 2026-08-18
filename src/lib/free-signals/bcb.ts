import "server-only";
import { logError } from "@/lib/log-error";

export type BcbItem = {
  cnpj: string;
  nomeInstituicao: string;
  segmento: string;
  municipio: string | null;
  uf: string | null;
};

const FETCH_TIMEOUT_MS = 10_000;

// Página pública (sem login) do Banco Central que explica esse conjunto de
// dados — usada como sourceUrl de cada sinal. A API em si (olinda.bcb.gov.br)
// devolve só JSON, não é um link útil pra alguém clicar e confirmar a fonte.
const SOURCE_URL = "https://dadosabertos.bcb.gov.br/dataset/relacao-de-instituicoes-em-funcionamento-no-pais";

type BcbApiItem = {
  CNPJ?: string;
  NOME_INSTITUICAO?: string;
  SEGMENTO?: string;
  MUNICIPIO?: string;
  UF?: string;
};

// API pública de dados abertos do Banco Central (Olinda, padrão OData) —
// sem autenticação, sem custo. "SedesSociedades" cobre instituições de
// pagamento, sociedades de crédito direto/microempreendedor, corretoras de
// câmbio etc. — o universo de fintechs/instituições não-bancárias que mais
// tem entrante novo. Bancos e cooperativas (SedesBancoComMultCE,
// SedesCooperativas) ficam de fora por ora — mudam bem menos, dá pra somar
// depois se fizer falta. Documentação:
// https://dadosabertos.bcb.gov.br/dataset/relacao-de-instituicoes-em-funcionamento-no-pais
const BCB_URL =
  "https://olinda.bcb.gov.br/olinda/servico/Instituicoes_em_funcionamento/versao/v1/odata/SedesSociedades?$format=json";

// A API só devolve a raiz do CNPJ (8 dígitos), não o número completo de 14
// — validado com chamada real antes de escrever isso. Guardamos como veio,
// sem forjar os 6 dígitos finais (fere a mesma regra de nunca fabricar
// precisão que não temos, ver NO_FABRICATION_INSTRUCTION em search.ts).
export async function fetchBcbSignalCandidates(): Promise<BcbItem[]> {
  try {
    const res = await fetch(BCB_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return [];
    const json = (await res.json()) as { value?: BcbApiItem[] };
    const items: BcbItem[] = [];
    for (const item of json.value ?? []) {
      if (!item.CNPJ || !item.NOME_INSTITUICAO || !item.SEGMENTO) continue;
      items.push({
        cnpj: item.CNPJ,
        nomeInstituicao: item.NOME_INSTITUICAO,
        segmento: item.SEGMENTO,
        municipio: item.MUNICIPIO ?? null,
        uf: item.UF ?? null,
      });
    }
    return items;
  } catch (err) {
    logError("free-signals: falha ao buscar Banco Central", err);
    return [];
  }
}

export { SOURCE_URL as BCB_SOURCE_URL };
