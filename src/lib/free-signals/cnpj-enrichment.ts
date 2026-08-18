import "server-only";
import { logError } from "@/lib/log-error";

export type DecisionMakerInfo = { name: string; role: string };

const FETCH_TIMEOUT_MS = 8_000;

// Ordem de preferência de cargo — quem decide compra tende a estar mais
// perto do topo dessa lista. Comparação por substring (case-insensitive)
// porque o texto do cargo varia bastante ("Diretor Presidente", "Sócio-
// Administrador" etc.) — nunca é um enum fechado nos dados da Receita.
const ROLE_PRIORITY = ["presidente", "diretor", "administrador", "sócio"];

type QsaEntry = { nome_socio?: string; qualificacao_socio?: string };
type BrasilApiCnpjResponse = { qsa?: QsaEntry[] };

function rolePriority(cargo: string): number {
  const lower = cargo.toLowerCase();
  const idx = ROLE_PRIORITY.findIndex((r) => lower.includes(r));
  return idx === -1 ? ROLE_PRIORITY.length : idx;
}

// BrasilAPI: projeto open-source construído em cima do dado oficial da
// Receita Federal (QSA — Quadro de Sócios e Administradores) — sem chave,
// sem custo. Só funciona com CNPJ completo de 14 dígitos (uma raiz de 8,
// como a que vem do Banco Central, não é suficiente). Documentação:
// https://brasilapi.com.br/docs#tag/CNPJ
//
// Fonte oficial de registro, não confirmação de quem decide compra de
// verdade — um sócio registrado pode ser só investidor passivo. Por isso
// isso não substitui o decisionMakerName que a busca por IA já encontra
// via fontes públicas (LinkedIn, imprensa) — é um dado a mais, não uma
// verdade absoluta.
export async function fetchDecisionMakerByCnpj(cnpj: string): Promise<DecisionMakerInfo | null> {
  if (cnpj.length !== 14) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      // Sem um User-Agent identificável, o WAF na frente da BrasilAPI
      // devolve 403 pra fetch do Node (validado ao vivo — curl "in natura"
      // passa, fetch sem header não) — não é bloqueio à API em si.
      headers: { "User-Agent": "SpinosBot/1.0 (+https://spinos.com.br)", Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as BrasilApiCnpjResponse;
    const qsa = (json.qsa ?? []).filter(
      (s): s is Required<QsaEntry> => Boolean(s.nome_socio) && Boolean(s.qualificacao_socio),
    );
    if (qsa.length === 0) return null;

    const best = [...qsa].sort((a, b) => rolePriority(a.qualificacao_socio) - rolePriority(b.qualificacao_socio))[0];
    return { name: best.nome_socio, role: best.qualificacao_socio };
  } catch (err) {
    logError("free-signals: falha ao enriquecer CNPJ via BrasilAPI", err, { cnpj });
    return null;
  }
}
