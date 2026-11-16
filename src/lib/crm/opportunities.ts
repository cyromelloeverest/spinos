import type { Prisma } from "@/generated/prisma/client";
import { ensureAccountForCompany } from "./accounts";
import { getDefaultPipeline, firstOpenStage, type StageRow } from "./pipeline-config";

type Tx = Prisma.TransactionClient;

type Ctx = { organizationId: string; userId: string | null };

export const NOVA = "NOVA";

async function loadScore(tx: Tx, organizationId: string, scoreId: string) {
  return tx.opportunityScore.findFirstOrThrow({ where: { id: scoreId, organizationId }, select: { id: true, companyId: true, accountId: true, headline: true, computedAt: true } });
}

async function accountIdFor(tx: Tx, organizationId: string, score: { id: string; companyId: string; accountId: string | null; computedAt: Date }): Promise<string> {
  if (score.accountId) return score.accountId;
  const accountId = await ensureAccountForCompany(tx, { organizationId, companyId: score.companyId, occurredAt: score.computedAt });
  await tx.opportunityScore.update({ where: { id: score.id }, data: { accountId } });
  return accountId;
}

function lifecycleFor(kind: StageRow["kind"]) {
  return kind === "WON" ? ("CUSTOMER" as const) : kind === "LOST" ? ("LOST" as const) : ("ENGAGED" as const);
}

// Coloca a conta no funil (se ainda não estiver) na etapa pedida.
async function putInStage(tx: Tx, ctx: Ctx, scoreId: string, stage: StageRow, lossNote?: string | null) {
  const score = await loadScore(tx, ctx.organizationId, scoreId);
  const accountId = await accountIdFor(tx, ctx.organizationId, score);
  const now = new Date();
  const closed = stage.kind !== "OPEN";
  const status = stage.kind === "WON" ? ("WON" as const) : stage.kind === "LOST" ? ("LOST" as const) : ("OPEN" as const);

  const current = await tx.opportunity.findFirst({ where: { accountId, organizationId: ctx.organizationId }, orderBy: { createdAt: "desc" } });
  if (!current) {
    const primary = await tx.contact.findFirst({ where: { accountId, organizationId: ctx.organizationId, isPrimary: true }, select: { id: true } });
    const created = await tx.opportunity.create({
      data: {
        organizationId: ctx.organizationId,
        accountId,
        primaryContactId: primary?.id ?? null,
        pipelineId: stage.pipelineId,
        stageId: stage.id,
        title: score.headline,
        ownerUserId: ctx.userId,
        lossNote: stage.kind === "LOST" ? lossNote ?? null : null,
        status,
        closedAt: closed ? now : null,
        stageChangedAt: now,
        lastActionByUserId: ctx.userId,
        lastActionAt: now,
      },
    });
    await tx.opportunityStageEvent.create({ data: { organizationId: ctx.organizationId, opportunityId: created.id, fromStageId: null, toStageId: stage.id, userId: ctx.userId } });
  } else if (current.stageId !== stage.id) {
    await tx.opportunity.update({
      where: { id: current.id },
      data: {
        stageId: stage.id,
        pipelineId: stage.pipelineId,
        status,
        closedAt: closed ? now : null,
        stageChangedAt: now,
        lastActionByUserId: ctx.userId,
        lastActionAt: now,
        // Ganho sem valor informado vale o valor previsto; ao reabrir, o valor ganho some.
        wonValueBRL: stage.kind === "WON" ? (current.wonValueBRL ?? current.expectedValueBRL) : null,
        lossNote: stage.kind === "LOST" ? lossNote ?? null : null,
        // Sem dono, quem mexe primeiro assume.
        ownerUserId: current.ownerUserId ?? ctx.userId,
      },
    });
    await tx.opportunityStageEvent.create({ data: { organizationId: ctx.organizationId, opportunityId: current.id, fromStageId: current.stageId, toStageId: stage.id, userId: ctx.userId } });
  }
  await tx.account.update({ where: { id: accountId }, data: { lifecycle: lifecycleFor(stage.kind) } });
  return { companyId: score.companyId };
}

// "Mover para o pipeline": entra na primeira etapa aberta, se ainda não estiver.
export async function startInPipeline(tx: Tx, ctx: Ctx, scoreId: string) {
  const pipeline = await getDefaultPipeline(tx, ctx.organizationId);
  const score = await loadScore(tx, ctx.organizationId, scoreId);
  const accountId = await accountIdFor(tx, ctx.organizationId, score);
  const already = await tx.opportunity.findFirst({ where: { accountId, organizationId: ctx.organizationId }, select: { id: true } });
  if (already) return;
  await putInStage(tx, ctx, scoreId, firstOpenStage(pipeline));
}

// Muda a etapa pela chave (CONTATO_FEITO, VENDIDO...). A chave "NOVA" devolve a
// conta para "oportunidades encontradas": a negociação é apagada, como era
// quando a etapa voltava a null. Devolve o tipo da etapa e o id da empresa
// para quem registra o Feedback.
export async function moveToStage(tx: Tx, ctx: Ctx, scoreId: string, stageKey: string, lossNote?: string | null): Promise<{ companyId: string; kind: "OPEN" | "WON" | "LOST" | "NOVA" }> {
  if (stageKey === NOVA) {
    const score = await loadScore(tx, ctx.organizationId, scoreId);
    const accountId = await accountIdFor(tx, ctx.organizationId, score);
    await tx.opportunity.deleteMany({ where: { accountId, organizationId: ctx.organizationId } });
    await tx.account.update({ where: { id: accountId }, data: { lifecycle: "TARGET" } });
    return { companyId: score.companyId, kind: "NOVA" };
  }
  const pipeline = await getDefaultPipeline(tx, ctx.organizationId);
  const stage = pipeline.stages.find((s) => s.key === stageKey);
  if (!stage) throw new Error(`Etapa desconhecida: ${stageKey}`);
  const { companyId } = await putInStage(tx, ctx, scoreId, stage, lossNote);
  return { companyId, kind: stage.kind };
}

// Descarta a oportunidade encontrada (continua existindo, fora das listas).
export async function dismissAccountForScore(tx: Tx, ctx: Ctx, scoreId: string) {
  const score = await loadScore(tx, ctx.organizationId, scoreId);
  const accountId = await accountIdFor(tx, ctx.organizationId, score);
  await tx.opportunityScore.update({ where: { id: scoreId }, data: { status: "DISMISSED", lastActionByUserId: ctx.userId, lastActionAt: new Date() } });
  await tx.account.update({ where: { id: accountId }, data: { lifecycle: "DISMISSED" } });
}

// Ganha ou perdida a partir da gaveta: usa a primeira etapa desse tipo no funil.
export async function moveToKind(tx: Tx, ctx: Ctx, scoreId: string, kind: "WON" | "LOST", lossNote?: string | null) {
  const pipeline = await getDefaultPipeline(tx, ctx.organizationId);
  const stage = pipeline.stages.find((s) => s.kind === kind);
  if (!stage) throw new Error("O funil não tem etapa de " + (kind === "WON" ? "ganho" : "perda"));
  return moveToStage(tx, ctx, scoreId, stage.key, lossNote);
}
