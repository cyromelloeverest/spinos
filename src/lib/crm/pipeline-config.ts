import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

// Funil padrão de toda organização que ainda não tem um do pacote de nicho: as
// mesmas 5 etapas que o Spinos sempre teve. O pacote de nicho (WP2) vai
// substituir isso por etapas do nicho; até lá, é o que todo mundo vê.
export const DEFAULT_PIPELINE_NAME = "Geral B2B";
export const DEFAULT_STAGES = [
  { key: "CONTATO_FEITO", name: "Contato feito", position: 1, kind: "OPEN" },
  { key: "VISITA_AGENDADA", name: "Visita agendada", position: 2, kind: "OPEN" },
  { key: "PROPOSTA_ENVIADA", name: "Proposta enviada", position: 3, kind: "OPEN" },
  { key: "VENDIDO", name: "Vendido", position: 4, kind: "WON" },
  { key: "PERDIDO", name: "Perdido", position: 5, kind: "LOST" },
] as const;

export type StageRow = { id: string; key: string; name: string; position: number; kind: "OPEN" | "WON" | "LOST"; pipelineId: string };
export type DefaultPipeline = { id: string; stages: StageRow[] };

// Devolve o funil padrão da organização com suas etapas em ordem, criando-o se
// ainda não existir (organização nova, ou criada entre a cópia dos dados e a
// troca do código). Seguro de chamar várias vezes e em paralelo: o par
// (pipelineId, key) é único e o insert ignora o que já existe.
export async function getDefaultPipeline(tx: Tx, organizationId: string): Promise<DefaultPipeline> {
  let pipeline = await tx.pipeline.findFirst({ where: { organizationId, isDefault: true }, orderBy: { createdAt: "asc" } });
  if (!pipeline) {
    pipeline = await tx.pipeline.create({ data: { organizationId, name: DEFAULT_PIPELINE_NAME, isDefault: true } });
  }
  let stages = await tx.stage.findMany({ where: { pipelineId: pipeline.id, organizationId }, orderBy: { position: "asc" } });
  if (stages.length === 0) {
    await tx.stage.createMany({
      data: DEFAULT_STAGES.map((s) => ({ organizationId, pipelineId: pipeline!.id, key: s.key, name: s.name, position: s.position, kind: s.kind })),
      skipDuplicates: true,
    });
    stages = await tx.stage.findMany({ where: { pipelineId: pipeline.id, organizationId }, orderBy: { position: "asc" } });
  }
  return { id: pipeline.id, stages: stages.map((s) => ({ id: s.id, key: s.key, name: s.name, position: s.position, kind: s.kind, pipelineId: s.pipelineId })) };
}

export function firstOpenStage(p: DefaultPipeline): StageRow {
  const stage = p.stages.find((s) => s.kind === "OPEN");
  if (!stage) throw new Error("Funil sem etapa aberta");
  return stage;
}
