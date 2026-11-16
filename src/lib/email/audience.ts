import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/*
 * Quem pode receber campanha. Regra de ouro: só contato com base legal registrada de CONSENTIMENTO ou
 * CONTRATO. Interesse legítimo (o que a prospecção gera) NÃO entra: nada de e-mail frio em massa.
 */

export const AUDIENCES = [
  { key: "clientes", label: "Clientes", hint: "Contatos de empresas com negociação ganha." },
  { key: "em_andamento", label: "Em negociação", hint: "Contatos de empresas com negociação em andamento." },
  { key: "todos", label: "Todos os contatos aptos", hint: "Qualquer contato com consentimento ou contrato registrado." },
] as const;
export type AudienceKey = (typeof AUDIENCES)[number]["key"];
export const isAudienceKey = (v: string): v is AudienceKey => AUDIENCES.some((a) => a.key === v);

export type Recipient = { contactId: string; email: string; firstName: string | null };
export type AudienceResult = { recipients: Recipient[]; excluded: { semEmail: number; semBaseLegal: number; descadastrados: number } };

const firstNameOf = (name: string) => name.trim().split(/\s+/)[0]?.slice(0, 40) || null;

export async function resolveAudience(tx: Tx, organizationId: string, audience: AudienceKey): Promise<AudienceResult> {
  const where: Prisma.ContactWhereInput = { organizationId, anonymizedAt: null, optedOutAt: null };
  if (audience === "clientes") where.account = { opportunities: { some: { status: "WON" } } };
  if (audience === "em_andamento") where.account = { opportunities: { some: { status: "OPEN" } } };
  // Quem já pediu para sair aparece só na contagem, para a pessoa entender por que o público é menor.
  const optedOut = await tx.contact.count({ where: { ...where, optedOutAt: { not: null } } });
  const contacts = await tx.contact.findMany({ where, select: { id: true, name: true, email: true, legalBasis: true }, orderBy: { createdAt: "asc" }, take: 20000 });
  const suppressed = new Set((await tx.emailSuppression.findMany({ where: { organizationId }, select: { email: true } })).map((s) => s.email));

  const seen = new Set<string>();
  const recipients: Recipient[] = [];
  const excluded = { semEmail: 0, semBaseLegal: 0, descadastrados: optedOut };
  for (const c of contacts) {
    const email = c.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      excluded.semEmail += 1;
      continue;
    }
    if (c.legalBasis !== "CONSENT" && c.legalBasis !== "CONTRACT") {
      excluded.semBaseLegal += 1;
      continue;
    }
    if (suppressed.has(email)) {
      excluded.descadastrados += 1;
      continue;
    }
    if (seen.has(email)) continue; // a mesma pessoa em duas empresas recebe uma vez só
    seen.add(email);
    recipients.push({ contactId: c.id, email, firstName: firstNameOf(c.name) });
  }
  return { recipients, excluded };
}

/** Descadastro, bounce ou reclamação: vale para todas as campanhas e marca os contatos com esse e-mail. */
export async function suppressEmail(tx: Tx, organizationId: string, rawEmail: string, reason: "UNSUBSCRIBE" | "BOUNCE" | "COMPLAINT" | "MANUAL") {
  const email = rawEmail.trim().toLowerCase();
  await tx.emailSuppression.upsert({ where: { organizationId_email: { organizationId, email } }, update: {}, create: { organizationId, email, reason } });
  await tx.contact.updateMany({ where: { organizationId, email: { equals: email, mode: "insensitive" }, optedOutAt: null }, data: { optedOutAt: new Date() } });
  await tx.emailMessage.updateMany({ where: { organizationId, email, status: "QUEUED" }, data: { status: "FAILED", error: "Descadastrado antes do envio" } });
}
