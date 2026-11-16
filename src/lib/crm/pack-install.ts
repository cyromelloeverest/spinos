import type { Prisma } from "@/generated/prisma/client";
import { getPack } from "@/packs/registry";
import { isAutomationKey } from "@/lib/automations/recipes";

type Tx = Prisma.TransactionClient;

export class PackNotFoundError extends Error {
  constructor(key: string) {
    super(`Pacote de nicho desconhecido: ${key}`);
    this.name = "PackNotFoundError";
  }
}

// Instala o pacote na organização: funil e etapas, automações recomendadas e o registro
// do pacote (com uma cópia do conteúdo, para o que a organização editar depois não
// quebrar quando o pacote ganhar uma versão nova). Só para organização SEM negociação:
// trocar de funil com negociação aberta bagunçaria as etapas, então recusa.
export async function installPack(tx: Tx, organizationId: string, packKey: string): Promise<{ packKey: string; version: string }> {
  const pack = getPack(packKey);
  if (!pack) throw new PackNotFoundError(packKey);

  const deals = await tx.opportunity.count({ where: { organizationId } });
  if (deals > 0) throw new Error("A organização já tem negociações; o funil não pode ser trocado.");

  // Funil: substitui o funil padrão (que só existe com as etapas genéricas).
  await tx.pipeline.deleteMany({ where: { organizationId } });
  const pipeline = await tx.pipeline.create({ data: { organizationId, name: pack.pipeline.name, isDefault: true } });
  await tx.stage.createMany({
    data: pack.pipeline.stages.map((s, i) => ({ organizationId, pipelineId: pipeline.id, key: s.key, name: s.name, position: i + 1, kind: s.kind })),
  });

  // Automações recomendadas pelo pacote (ligadas ou não, conforme o pacote).
  for (const [key, entry] of Object.entries(pack.automations)) {
    if (!isAutomationKey(key)) continue;
    await tx.automation.upsert({
      where: { organizationId_key: { organizationId, key } },
      update: { enabled: entry.enabled, config: entry.config as Prisma.InputJsonValue },
      create: { organizationId, key, enabled: entry.enabled, config: entry.config as Prisma.InputJsonValue },
    });
  }

  await tx.organizationPack.upsert({
    where: { organizationId },
    update: { packKey: pack.key, packVersion: pack.version, snapshot: pack as unknown as Prisma.InputJsonValue },
    create: { organizationId, packKey: pack.key, packVersion: pack.version, snapshot: pack as unknown as Prisma.InputJsonValue },
  });
  return { packKey: pack.key, version: pack.version };
}

// O pacote instalado na organização (a cópia gravada, não o arquivo atual).
export async function getInstalledPack(tx: Tx, organizationId: string) {
  const row = await tx.organizationPack.findUnique({ where: { organizationId } });
  if (!row) return null;
  // Revalida a cópia gravada: se o formato mudar no futuro, devolve null em vez de quebrar a tela.
  const { NichePackSchema } = await import("@/packs/schema");
  const parsed = NichePackSchema.safeParse(row.snapshot);
  return parsed.success ? parsed.data : null;
}
