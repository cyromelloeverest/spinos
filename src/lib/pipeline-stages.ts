export const PIPELINE_STAGE_ORDER = [
  "CONTATO_FEITO",
  "VISITA_AGENDADA",
  "PROPOSTA_ENVIADA",
  "VENDIDO",
  "PERDIDO",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGE_ORDER)[number];

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
