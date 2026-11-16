import type { Prisma } from "@/generated/prisma/client";
import { ORIGIN_OPTIONS } from "./origin-options";
import { getDefaultPipeline, firstOpenStage } from "./pipeline-config";
import { onStageChanged, onLeadCreated } from "@/lib/automations/engine";

type Tx = Prisma.TransactionClient;

export class LeadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadValidationError";
  }
}

export class DuplicateLeadError extends Error {
  constructor(
    public existingAccountName: string,
    public existingAccountId: string | null = null,
    public existingContactId: string | null = null,
  ) {
    super(`Já existe um contato com esse telefone ou e-mail (${existingAccountName}).`);
    this.name = "DuplicateLeadError";
  }
}

export type NewLead = {
  name: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  message?: string | null;
  originKey: string;
  ownerUserId?: string | null;
};

const onlyDigits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

// Lead = conta nova + contato principal + negociação na primeira etapa + primeiro toque
// de origem. Não existe tabela de lead: é isso tudo junto. Recusa duplicata (mesmo
// telefone ou e-mail já cadastrados na organização) em vez de criar uma segunda conta.
export async function createLead(tx: Tx, ctx: { organizationId: string; userId: string | null }, input: NewLead) {
  const { organizationId } = ctx;
  const name = input.name.trim();
  if (!name) throw new LeadValidationError("Informe o nome do contato.");
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone?.trim() || null;
  if (!email && !phone) throw new LeadValidationError("Informe o telefone ou o e-mail do contato.");
  const origin = ORIGIN_OPTIONS.find((o) => o.key === input.originKey);
  if (!origin) throw new LeadValidationError("Origem inválida.");

  const phoneDigits = onlyDigits(phone);
  const clash = await tx.contact.findFirst({
    where: {
      organizationId,
      anonymizedAt: null,
      OR: [
        ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
        ...(phoneDigits.length >= 8 ? [{ phoneE164: phoneDigits }] : []),
      ],
    },
    include: { account: { select: { name: true } } },
  });
  if (clash) throw new DuplicateLeadError(clash.account?.name ?? clash.name, clash.accountId, clash.id);

  const pipeline = await getDefaultPipeline(tx, organizationId);
  const stage = firstOpenStage(pipeline);
  const now = new Date();
  const company = input.company?.trim() || name;

  const account = await tx.account.create({ data: { organizationId, name: company, lifecycle: "ENGAGED" }, select: { id: true } });
  const contact = await tx.contact.create({
    data: { organizationId, accountId: account.id, name, email, phone, phoneE164: phoneDigits.length >= 8 ? phoneDigits : null, isPrimary: true },
    select: { id: true },
  });
  await tx.origin.create({ data: { organizationId, accountId: account.id, contactId: contact.id, kind: origin.kind, channel: origin.key, isFirstTouch: true, occurredAt: now } });
  const deal = await tx.opportunity.create({
    data: {
      organizationId,
      accountId: account.id,
      primaryContactId: contact.id,
      pipelineId: pipeline.id,
      stageId: stage.id,
      title: input.message?.trim() ? `Lead: ${input.message.trim().slice(0, 80)}` : `Lead: ${company}`,
      ownerUserId: input.ownerUserId ?? null,
      stageChangedAt: now,
      createdAt: now,
    },
    select: { id: true },
  });
  await tx.opportunityStageEvent.create({ data: { organizationId, opportunityId: deal.id, fromStageId: null, toStageId: stage.id, userId: ctx.userId } });
  await onLeadCreated(tx, ctx, deal.id);
  await onStageChanged(tx, ctx, { opportunityId: deal.id, stageKey: stage.key, stageKind: stage.kind, stageChangedAt: now, now });

  // Sem responsável definido e sem rodízio: quem cadastrou assume.
  const fresh = await tx.opportunity.findUniqueOrThrow({ where: { id: deal.id }, select: { ownerUserId: true } });
  if (!fresh.ownerUserId && ctx.userId) await tx.opportunity.update({ where: { id: deal.id }, data: { ownerUserId: ctx.userId } });
  return { opportunityId: deal.id, accountId: account.id };
}

// SLA do primeiro atendimento: padrão de 30 minutos (a automação "Lead sem resposta"
// pode ajustar). Devolve quanto falta (negativo = estourou), em minutos.
export function slaMinutesLeft(createdAt: Date, slaMinutes: number, now: Date = new Date()): number {
  return Math.round((createdAt.getTime() + slaMinutes * 60_000 - now.getTime()) / 60_000);
}

export function slaLabel(minutesLeft: number): string {
  const abs = Math.abs(minutesLeft);
  const text = abs >= 120 ? `${Math.round(abs / 60)} h` : abs >= 60 ? `${Math.floor(abs / 60)} h ${abs % 60} min` : `${abs} min`;
  return minutesLeft >= 0 ? `Atender em ${text}` : `Venceu há ${text}`;
}
