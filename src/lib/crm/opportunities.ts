import type { Prisma } from "@/generated/prisma/client";
import { ensureAccountForCompany } from "./accounts";
import { getDefaultPipeline, firstOpenStage, type StageRow } from "./pipeline-config";
import { onStageChanged } from "@/lib/automations/engine";

type Tx = Prisma.TransactionClient;

type Ctx = { organizationId: string; userId: string | null };

export const NOVA = "NOVA";

// Uma referência é o id de uma nota (oportunidade encontrada pela IA) ou o id de uma
// negociação (lead que entrou por formulário ou cadastro manual, sem nota). Os dois
// levam à mesma conta.
type Target = { accountId: string; scoreId: string | null; companyId: string | null; headline: string };

async function resolveRef(tx: Tx, organizationId: string, ref: string): Promise<Target> {
  const score = await tx.opportunityScore.findFirst({ where: { id: ref, organizationId }, select: { id: true, companyId: true, accountId: true, headline: true, computedAt: true } });
  if (score) {
    const accountId = score.accountId ?? (await ensureAccountForCompany(tx, { organizationId, companyId: score.companyId, occurredAt: score.computedAt }));
    if (!score.accountId) await tx.opportunityScore.update({ where: { id: score.id }, data: { accountId } });
    return { accountId, scoreId: score.id, companyId: score.companyId, headline: score.headline };
  }
  const deal = await tx.opportunity.findFirst({ where: { id: ref, organizationId }, select: { accountId: true, title: true } });
  if (!deal) throw new Error("Oportunidade não encontrada");
  return { accountId: deal.accountId, scoreId: null, companyId: null, headline: deal.title };
}

function lifecycleFor(kind: StageRow["kind"]) {
  return kind === "WON" ? ("CUSTOMER" as const) : kind === "LOST" ? ("LOST" as const) : ("ENGAGED" as const);
}

// Coloca a conta no funil (se ainda não estiver) na etapa pedida.
async function putInStage(tx: Tx, ctx: Ctx, ref: string, stage: StageRow, lossNote?: string | null) {
  const target = await resolveRef(tx, ctx.organizationId, ref);
  const accountId = target.accountId;
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
        title: target.headline,
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
    await onStageChanged(tx, ctx, { opportunityId: created.id, stageKey: stage.key, stageKind: stage.kind, stageChangedAt: now, now });
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
    await onStageChanged(tx, ctx, { opportunityId: current.id, stageKey: stage.key, stageKind: stage.kind, stageChangedAt: now, now });
  }
  await tx.account.update({ where: { id: accountId }, data: { lifecycle: lifecycleFor(stage.kind) } });
  return { companyId: target.companyId, scoreId: target.scoreId };
}

// "Mover para o pipeline": entra na primeira etapa aberta, se ainda não estiver.
export async function startInPipeline(tx: Tx, ctx: Ctx, ref: string) {
  const pipeline = await getDefaultPipeline(tx, ctx.organizationId);
  const target = await resolveRef(tx, ctx.organizationId, ref);
  const already = await tx.opportunity.findFirst({ where: { accountId: target.accountId, organizationId: ctx.organizationId }, select: { id: true } });
  if (already) return;
  await putInStage(tx, ctx, ref, firstOpenStage(pipeline));
}

// Muda a etapa pela chave (CONTATO_FEITO, VENDIDO...). A chave "NOVA" devolve a
// conta para "oportunidades encontradas": a negociação é apagada, como era
// quando a etapa voltava a null. Devolve o tipo da etapa e o id da empresa
// para quem registra o Feedback.
export async function moveToStage(tx: Tx, ctx: Ctx, ref: string, stageKey: string, lossNote?: string | null): Promise<{ companyId: string | null; scoreId: string | null; kind: "OPEN" | "WON" | "LOST" | "NOVA" }> {
  if (stageKey === NOVA) {
    const target = await resolveRef(tx, ctx.organizationId, ref);
    // Só uma oportunidade encontrada pela IA (com nota) pode voltar para a lista; um lead
    // cadastrado não tem para onde voltar.
    if (!target.scoreId) throw new Error("Esse lead não tem uma oportunidade de origem para voltar.");
    await tx.opportunity.deleteMany({ where: { accountId: target.accountId, organizationId: ctx.organizationId } });
    await tx.account.update({ where: { id: target.accountId }, data: { lifecycle: "TARGET" } });
    return { companyId: target.companyId, scoreId: target.scoreId, kind: "NOVA" };
  }
  const pipeline = await getDefaultPipeline(tx, ctx.organizationId);
  const stage = pipeline.stages.find((s) => s.key === stageKey);
  if (!stage) throw new Error(`Etapa desconhecida: ${stageKey}`);
  const { companyId, scoreId } = await putInStage(tx, ctx, ref, stage, lossNote);
  return { companyId, scoreId, kind: stage.kind };
}

// Descarta a oportunidade encontrada (continua existindo, fora das listas).
export async function dismissAccountForScore(tx: Tx, ctx: Ctx, scoreId: string) {
  const target = await resolveRef(tx, ctx.organizationId, scoreId);
  if (!target.scoreId) throw new Error("Só oportunidades encontradas pela IA podem ser descartadas aqui.");
  await tx.opportunityScore.update({ where: { id: scoreId }, data: { status: "DISMISSED", lastActionByUserId: ctx.userId, lastActionAt: new Date() } });
  await tx.account.update({ where: { id: target.accountId }, data: { lifecycle: "DISMISSED" } });
}

// Ganha ou perdida a partir da gaveta: usa a primeira etapa desse tipo no funil.
export async function moveToKind(tx: Tx, ctx: Ctx, ref: string, kind: "WON" | "LOST", lossNote?: string | null) {
  const pipeline = await getDefaultPipeline(tx, ctx.organizationId);
  const stage = pipeline.stages.find((s) => s.kind === kind);
  if (!stage) throw new Error("O funil não tem etapa de " + (kind === "WON" ? "ganho" : "perda"));
  return moveToStage(tx, ctx, ref, stage.key, lossNote);
}
