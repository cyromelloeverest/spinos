import { getPlan } from "@/lib/plans";

// Liberação do módulo: flag manual da organização OU recurso do plano
// (nenhum plano inclui hoje). Função pura, sem I/O, pra ser testável.
export function isBiddingEnabled(org: { plan: string; biddingEnabled: boolean }): boolean {
  return org.biddingEnabled || getPlan(org.plan).features.licitacoes;
}
