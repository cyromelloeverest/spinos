import type { ICP } from "@/generated/prisma/client";

// Heurístico, sem chamada de IA de propósito (custo zero, roda em toda
// checagem de busca) — detecta o caso real que já vimos: 1 segmento
// genérico tipo "Empresas B2B" e nenhum outro sinal preenchido. Não é uma
// lista de palavras proibidas (frágil, sempre incompleta) — mede riqueza
// geral do ICP: qualquer descrição livre de verdade OU outro campo
// preenchido além de 1 segmento já tira do estado "genérico".
const MIN_DESCRIPTION_LENGTH = 20;

export function isIcpTooGeneric(
  icp: Pick<
    ICP,
    | "segments"
    | "states"
    | "cities"
    | "decisionMakerTitles"
    | "technologies"
    | "keywords"
    | "productsSold"
    | "servicesSold"
    | "idealCustomerDescription"
  >,
): boolean {
  const hasDescription = (icp.idealCustomerDescription?.trim().length ?? 0) >= MIN_DESCRIPTION_LENGTH;
  if (hasDescription) return false;

  const hasOtherSignal =
    icp.states.length > 0 ||
    icp.cities.length > 0 ||
    icp.decisionMakerTitles.length > 0 ||
    icp.technologies.length > 0 ||
    icp.keywords.length > 0 ||
    icp.productsSold.length > 0 ||
    icp.servicesSold.length > 0;

  return icp.segments.length <= 1 && !hasOtherSignal;
}
