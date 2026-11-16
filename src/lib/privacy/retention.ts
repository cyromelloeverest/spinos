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
  // Uma única instrução para todos os endereços antigos (e não uma por linha): cabe no tempo da rotina.
  // O marcador tem hash + final do id, então continua único por campanha.
  const scrubbed = await tx.$executeRaw`
    UPDATE email_messages
    SET email = 'antigo-' || substr(md5("organizationId" || ':' || email), 1, 16) || '-' || right(id, 6) || '@anonimizado.invalid', "firstName" = NULL
    WHERE "organizationId" = ${organizationId} AND "createdAt" < ${daysAgo(RETENTION.emailRecipientDays, now)} AND email NOT LIKE '%@anonimizado.invalid'`;
  const drafts = await tx.contentDraft.deleteMany({ where: { organizationId, status: "DISCARDED", updatedAt: { lt: daysAgo(RETENTION.discardedDraftDays, now) } } });
  return { siteEventsDeleted: events.count, emailRecipientsScrubbed: Number(scrubbed), draftsDeleted: drafts.count };
}
