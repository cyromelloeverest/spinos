import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;
type Ctx = { organizationId: string; userId: string | null };
export type ActivityTypeKey = "CALL" | "WHATSAPP" | "EMAIL" | "LINKEDIN" | "MEETING" | "PROPOSAL" | "TASK" | "OTHER";

export const ACTIVITY_TYPE_LABEL: Record<ActivityTypeKey, string> = {
  CALL: "Ligar",
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
  LINKEDIN: "LinkedIn",
  MEETING: "Reunião",
  PROPOSAL: "Proposta",
  TASK: "Tarefa",
  OTHER: "Outro",
};

export class NextStepRequiredError extends Error {
  constructor() {
    super("Defina o próximo passo antes de concluir (ou confirme que não há).");
    this.name = "NextStepRequiredError";
  }
}

export type NewActivity = {
  opportunityId?: string | null;
  accountId?: string | null;
  contactId?: string | null;
  type: ActivityTypeKey;
  title: string;
  dueAt: Date;
  notes?: string | null;
  automation?: string | null;
  ownerUserId?: string | null;
  clientRequestId?: string | null;
};

// A próxima atividade aberta da negociação, guardada na própria negociação para a
// faixa de avisos e o cartão do quadro não precisarem somar a cada abertura.
export async function refreshNextActivity(tx: Tx, organizationId: string, opportunityId: string): Promise<void> {
  const next = await tx.activity.findFirst({
    where: { organizationId, opportunityId, status: "OPEN", dueAt: { not: null } },
    orderBy: { dueAt: "asc" },
    select: { dueAt: true },
  });
  await tx.opportunity.updateMany({ where: { id: opportunityId, organizationId }, data: { nextActivityAt: next?.dueAt ?? null } });
}

export async function scheduleActivity(tx: Tx, ctx: Ctx, input: NewActivity) {
  const title = input.title.trim();
  if (!title) throw new Error("Informe o que precisa ser feito.");

  let accountId = input.accountId ?? null;
  let ownerUserId = input.ownerUserId ?? ctx.userId;
  if (input.opportunityId) {
    const opp = await tx.opportunity.findFirstOrThrow({ where: { id: input.opportunityId, organizationId: ctx.organizationId }, select: { accountId: true, ownerUserId: true } });
    accountId = accountId ?? opp.accountId;
    ownerUserId = input.ownerUserId ?? opp.ownerUserId ?? ctx.userId;
  }

  // Idempotente por pedido do cliente (duplo clique, retentativa): o mesmo
  // clientRequestId devolve a atividade já criada.
  if (input.clientRequestId) {
    const existing = await tx.activity.findFirst({ where: { organizationId: ctx.organizationId, clientRequestId: input.clientRequestId } });
    if (existing) return existing;
  }

  const activity = await tx.activity.create({
    data: {
      organizationId: ctx.organizationId,
      type: input.type,
      title,
      notes: input.notes?.trim() || null,
      dueAt: input.dueAt,
      accountId,
      contactId: input.contactId ?? null,
      opportunityId: input.opportunityId ?? null,
      ownerUserId,
      automation: input.automation ?? null,
      clientRequestId: input.clientRequestId ?? null,
    },
  });
  if (input.opportunityId) await refreshNextActivity(tx, ctx.organizationId, input.opportunityId);
  return activity;
}

// Concluir uma atividade de negociação aberta exige o próximo passo: ou um novo é
// agendado junto, ou já existe outro aberto, ou a pessoa confirma que não há
// (allowNoNext). É a regra que mantém o funil andando.
export async function completeActivity(
  tx: Tx,
  ctx: Ctx,
  activityId: string,
  input: { outcome?: string | null; next?: NewActivity | null; allowNoNext?: boolean },
) {
  const activity = await tx.activity.findFirstOrThrow({ where: { id: activityId, organizationId: ctx.organizationId } });
  if (activity.status !== "OPEN") return activity;

  if (activity.opportunityId) {
    const opp = await tx.opportunity.findFirst({ where: { id: activity.opportunityId, organizationId: ctx.organizationId }, select: { status: true } });
    if (opp?.status === "OPEN" && !input.next && !input.allowNoNext) {
      const others = await tx.activity.count({ where: { organizationId: ctx.organizationId, opportunityId: activity.opportunityId, status: "OPEN", id: { not: activity.id } } });
      if (others === 0) throw new NextStepRequiredError();
    }
  }

  const done = await tx.activity.update({
    where: { id: activity.id },
    data: { status: "DONE", doneAt: new Date(), outcome: input.outcome?.trim() || null },
  });
  if (input.next) await scheduleActivity(tx, ctx, { ...input.next, opportunityId: input.next.opportunityId ?? activity.opportunityId, accountId: input.next.accountId ?? activity.accountId, contactId: input.next.contactId ?? activity.contactId });
  if (activity.opportunityId) {
    await refreshNextActivity(tx, ctx.organizationId, activity.opportunityId);
    // Qualquer atividade concluída conta como primeiro atendimento, uma vez só.
    await tx.opportunity.updateMany({ where: { id: activity.opportunityId, organizationId: ctx.organizationId, firstResponseAt: null }, data: { firstResponseAt: new Date() } });
  }
  return done;
}

export async function rescheduleActivity(tx: Tx, ctx: Ctx, activityId: string, dueAt: Date) {
  const activity = await tx.activity.findFirstOrThrow({ where: { id: activityId, organizationId: ctx.organizationId, status: "OPEN" } });
  await tx.activity.update({ where: { id: activity.id }, data: { dueAt } });
  if (activity.opportunityId) await refreshNextActivity(tx, ctx.organizationId, activity.opportunityId);
}

export async function cancelActivity(tx: Tx, ctx: Ctx, activityId: string) {
  const activity = await tx.activity.findFirstOrThrow({ where: { id: activityId, organizationId: ctx.organizationId, status: "OPEN" } });
  await tx.activity.update({ where: { id: activity.id }, data: { status: "CANCELED" } });
  if (activity.opportunityId) await refreshNextActivity(tx, ctx.organizationId, activity.opportunityId);
}
