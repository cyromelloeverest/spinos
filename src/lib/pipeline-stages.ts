export const PIPELINE_STAGE_ORDER = [
  "CONTATO_FEITO",
  "VISITA_AGENDADA",
  "PROPOSTA_ENVIADA",
  "VENDIDO",
  "PERDIDO",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGE_ORDER)[number];

// Não é um valor real de PipelineStage no banco — representa stage: null
// (oportunidade ainda não movida pro pipeline). Continua sendo esse mesmo
// "null" em todo o resto do sistema (limite de plano, KPIs do dashboard,
// Assistente de Vendas) — esse sentinel existe só pra virar a primeira
// coluna do quadro do Pipeline, sem precisar de um valor novo no enum.
export const NOVA_STAGE_ID = "NOVA";
export const NOVA_STAGE_LABEL = "Oportunidades";

export const PIPELINE_STAGE_LABEL: Record<PipelineStage, string> = {
  CONTATO_FEITO: "Contato feito",
  VISITA_AGENDADA: "Visita agendada",
  PROPOSTA_ENVIADA: "Proposta enviada",
  VENDIDO: "Vendido",
  PERDIDO: "Perdido",
};

export function pipelineStageColor(stage: string, defaultColor: string): string {
  if (stage === "VENDIDO") return "var(--good)";
  if (stage === "PERDIDO") return "var(--critical)";
  return defaultColor;
}
