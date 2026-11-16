import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * LGPD, direito de eliminação de uma pessoa: apaga o que a identifica (nome, e-mail, telefone, cargo,
 * observações) em todos os módulos, mantendo a conta e a negociação para o histórico comercial.
 * Nos e-mails enviados, o endereço vira um marcador sem volta, para os números da campanha continuarem
 * fechando sem guardar a pessoa. A lista de descadastro NÃO é apagada: honrar o pedido de sair é
 * justamente o que impede que a pessoa volte a receber e-mail.
 */
export async function anonymizeContactData(tx: Tx, organizationId: string, contactId: string): Promise<boolean> {
  const contact = await tx.contact.findFirst({ where: { id: contactId, organizationId }, select: { id: true, email: true, anonymizedAt: true } });
  if (!contact) return false;
  const marker = `removido-${contact.id}@anonimizado.invalid`;
  await tx.emailMessage.updateMany({ where: { organizationId, OR: [{ contactId: contact.id }, ...(contact.email ? [{ email: { equals: contact.email, mode: "insensitive" as const } }] : [])] }, data: { email: marker, firstName: null } });
  await tx.activity.updateMany({ where: { organizationId, contactId: contact.id }, data: { notes: null } });
  await tx.contact.update({
    where: { id: contact.id },
    data: { name: "Pessoa removida (LGPD)", jobTitle: null, email: null, phone: null, phoneE164: null, linkedinUrl: null, legalBasisNote: null, anonymizedAt: contact.anonymizedAt ?? new Date(), isPrimary: false },
  });
  return true;
}

/** Direito de acesso: tudo que o Spinos guarda sobre UMA pessoa, para entregar a ela. */
export async function contactDataExport(tx: Tx, organizationId: string, contactId: string) {
  const contact = await tx.contact.findFirst({ where: { id: contactId, organizationId }, include: { account: { select: { name: true } } } });
  if (!contact) return null;
  const [activities, origins, messages] = await Promise.all([
    tx.activity.findMany({ where: { organizationId, contactId }, orderBy: { createdAt: "asc" }, select: { type: true, title: true, notes: true, status: true, dueAt: true, doneAt: true, createdAt: true } }),
    tx.origin.findMany({ where: { organizationId, contactId }, orderBy: { occurredAt: "asc" }, select: { kind: true, channel: true, utmSource: true, utmMedium: true, utmCampaign: true, referrerHost: true, occurredAt: true } }),
    tx.emailMessage.findMany({ where: { organizationId, contactId }, orderBy: { createdAt: "asc" }, select: { status: true, sentAt: true, campaign: { select: { name: true, subject: true } } } }),
  ]);
  const suppressed = contact.email ? Boolean(await tx.emailSuppression.findUnique({ where: { organizationId_email: { organizationId, email: contact.email.toLowerCase() } } })) : false;
  return {
    exportadoEm: new Date().toISOString(),
    pessoa: { nome: contact.name, cargo: contact.jobTitle, email: contact.email, telefone: contact.phone, linkedin: contact.linkedinUrl, empresa: contact.account?.name ?? null, cadastradaEm: contact.createdAt },
    baseLegal: { tipo: contact.legalBasis, observacao: contact.legalBasisNote },
    pediuParaNaoReceberContato: Boolean(contact.optedOutAt) || suppressed,
    anonimizadaEm: contact.anonymizedAt,
    atividades: activities,
    origens: origins,
    emailsRecebidos: messages.map((m) => ({ campanha: m.campaign.name, assunto: m.campaign.subject, situacao: m.status, enviadoEm: m.sentAt })),
  };
}
