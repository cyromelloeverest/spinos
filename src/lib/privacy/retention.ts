import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

// Prazos de guarda (mesmos da política de privacidade): quanto menos tempo, menos risco.
export const RETENTION = {
  siteEventDays: 425, // ~14 meses de visitas, o bastante para comparar ano contra ano
  emailRecipientDays: 730, // 24 meses de endereço de destinatário; depois só os números
  discardedDraftDays: 90,
} as const;

const daysAgo = (days: number, now: Date) => new Date(now.getTime() - days * 86400000);

/**
 * Rotina diária de retenção de UMA organização (roda dentro do contexto dela):
 * - apaga visitas do site antigas (já são anônimas, mas não precisam ficar para sempre);
 * - troca o endereço de destinatários de campanhas antigas por um marcador sem volta, mantendo os números;
 * - apaga rascunhos de conteúdo descartados há muito tempo.
 */
export async function runRetention(tx: Tx, organizationId: string, now: Date = new Date()) {
  const events = await tx.siteEvent.deleteMany({ where: { organizationId, createdAt: { lt: daysAgo(RETENTION.siteEventDays, now) } } });
  const old = await tx.emailMessage.findMany({ where: { organizationId, createdAt: { lt: daysAgo(RETENTION.emailRecipientDays, now) }, NOT: { email: { endsWith: "@anonimizado.invalid" } } }, select: { id: true, email: true }, take: 5000 });
  for (const m of old) {
    const hash = createHash("sha256").update(`${organizationId}:${m.email}`).digest("hex").slice(0, 16);
    await tx.emailMessage.update({ where: { id: m.id }, data: { email: `antigo-${hash}-${m.id.slice(-6)}@anonimizado.invalid`, firstName: null } });
  }
  const drafts = await tx.contentDraft.deleteMany({ where: { organizationId, status: "DISCARDED", updatedAt: { lt: daysAgo(RETENTION.discardedDraftDays, now) } } });
  return { siteEventsDeleted: events.count, emailRecipientsScrubbed: old.length, draftsDeleted: drafts.count };
}
