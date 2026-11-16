"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentOrganizationId, getCurrentUserId } from "@/lib/auth/current-org";
import { withOrgContext } from "@/lib/db/with-org-context";
import { parseMoneyInput } from "@/lib/crm/money";
import { parseBrasiliaDateTime } from "@/lib/crm/dates";
import { ORIGIN_OPTIONS, setFirstTouchOrigin } from "@/lib/crm/origin-options";
import { scheduleActivity, completeActivity, rescheduleActivity, cancelActivity, NextStepRequiredError, type ActivityTypeKey } from "@/lib/crm/activities";
import { moveToKind, moveToStage, startInPipeline } from "@/lib/crm/opportunities";
import { getDefaultPipeline } from "@/lib/crm/pipeline-config";
import { createLead, DuplicateLeadError, LeadValidationError } from "@/lib/crm/leads";
import { syncFeedback, type LossReasonKey } from "@/lib/crm/feedback";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

const ACTIVITY_TYPES: ActivityTypeKey[] = ["CALL", "WHATSAPP", "EMAIL", "LINKEDIN", "MEETING", "PROPOSAL", "TASK", "OTHER"];
const LOSS_REASONS: LossReasonKey[] = ["NOT_INTERESTED", "WRONG_FIT", "NO_RESPONSE"];

class UserError extends Error {}

async function requireCtx() {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) redirect("/onboarding");
  const userId = await getCurrentUserId();
  return { organizationId, userId };
}

// Redireciona de volta ao pipeline com a gaveta aberta, mantendo o filtro
// "Minhas / Toda a equipe". Nunca é chamado dentro de try/catch (redirect lança).
function back(scoreId: string, formData: FormData | null, extra: { erro?: string; salvo?: boolean } = {}): never {
  const owner = formData && String(formData.get("owner") ?? "") === "all" ? "all" : "me";
  const q = new URLSearchParams({ abrir: scoreId, owner });
  if (extra.erro) q.set("erro", extra.erro);
  if (extra.salvo) q.set("salvo", "1");
  redirect(`/pipeline?${q.toString()}`);
}

async function run(scoreId: string, formData: FormData | null, work: (tx: Tx, c: { organizationId: string; userId: string | null }) => Promise<void>): Promise<never> {
  const c = await requireCtx();
  let error: string | undefined;
  try {
    await withOrgContext(c.organizationId, (tx) => work(tx, c));
  } catch (err) {
    if (err instanceof UserError || err instanceof NextStepRequiredError) error = err.message;
    else {
      console.error("crm action failed", err);
      error = "Não foi possível salvar. Tente novamente.";
    }
  }
  revalidatePath("/pipeline");
  revalidatePath("/");
  return back(scoreId, formData, error ? { erro: error } : { salvo: true });
}

// A negociação da nota; erro de usuário se a nota ainda não está no funil.
async function dealOf(tx: Tx, organizationId: string, ref: string) {
  // A referência é o id da nota (oportunidade da IA) ou da própria negociação (lead).
  const direct = await tx.opportunity.findFirst({ where: { id: ref, organizationId } });
  if (direct) return direct;
  const score = await tx.opportunityScore.findFirst({ where: { id: ref, organizationId }, select: { accountId: true } });
  const deal = score?.accountId ? await tx.opportunity.findFirst({ where: { accountId: score.accountId, organizationId }, orderBy: { createdAt: "desc" } }) : null;
  if (!deal) throw new UserError("Mova a oportunidade para o pipeline primeiro.");
  return deal;
}

function readStep(formData: FormData, prefix = "") {
  const type = String(formData.get(`${prefix}type`) ?? "") as ActivityTypeKey;
  const title = String(formData.get(`${prefix}title`) ?? "").trim();
  const dueAt = parseBrasiliaDateTime(String(formData.get(`${prefix}dueAt`) ?? ""));
  if (!ACTIVITY_TYPES.includes(type)) throw new UserError("Escolha o tipo do próximo passo.");
  if (!title) throw new UserError("Diga o que precisa ser feito.");
  if (!dueAt) throw new UserError("Informe uma data e hora válidas.");
  return { type, title, dueAt, notes: String(formData.get(`${prefix}notes`) ?? "").trim() || null };
}

export async function startDeal(scoreId: string, formData: FormData) {
  return run(scoreId, formData, async (tx, c) => {
    await startInPipeline(tx, c, scoreId);
  });
}

export async function saveDetails(scoreId: string, formData: FormData) {
  return run(scoreId, formData, async (tx, c) => {
    const deal = await dealOf(tx, c.organizationId, scoreId);
    const expected = parseMoneyInput(String(formData.get("expectedValue") ?? ""));
    if (expected === undefined) throw new UserError("Valor previsto inválido.");
    const billing = String(formData.get("billing") ?? "ONE_TIME") === "RECURRING" ? "RECURRING" : "ONE_TIME";
    const ownerUserId = String(formData.get("ownerUserId") ?? "").trim() || null;
    if (ownerUserId) {
      const member = await tx.membership.findFirst({ where: { organizationId: c.organizationId, userId: ownerUserId }, select: { id: true } });
      if (!member) throw new UserError("Essa pessoa não faz parte da equipe.");
    }
    await tx.opportunity.update({
      where: { id: deal.id },
      data: { expectedValueBRL: expected, billing, ownerUserId, lastActionByUserId: c.userId, lastActionAt: new Date() },
    });
    const originKey = String(formData.get("origin") ?? "").trim();
    if (originKey) {
      if (!ORIGIN_OPTIONS.some((o) => o.key === originKey)) throw new UserError("Origem inválida.");
      await setFirstTouchOrigin(tx, { organizationId: c.organizationId, accountId: deal.accountId, originKey });
    }
  });
}

export async function addStep(scoreId: string, formData: FormData) {
  return run(scoreId, formData, async (tx, c) => {
    const deal = await dealOf(tx, c.organizationId, scoreId);
    await scheduleActivity(tx, c, { ...readStep(formData), opportunityId: deal.id, contactId: deal.primaryContactId });
  });
}

export async function finishStep(scoreId: string, activityId: string, formData: FormData) {
  return run(scoreId, formData, async (tx, c) => {
    const hasNext = String(formData.get("next.title") ?? "").trim() !== "";
    await completeActivity(tx, c, activityId, {
      outcome: String(formData.get("outcome") ?? ""),
      next: hasNext ? { ...readStep(formData, "next."), } : null,
      allowNoNext: String(formData.get("allowNoNext") ?? "") === "on",
    });
  });
}

export async function moveStep(scoreId: string, activityId: string, formData: FormData) {
  return run(scoreId, formData, async (tx, c) => {
    const dueAt = parseBrasiliaDateTime(String(formData.get("dueAt") ?? ""));
    if (!dueAt) throw new UserError("Informe uma data e hora válidas.");
    await rescheduleActivity(tx, c, activityId, dueAt);
  });
}

export async function dropStep(scoreId: string, activityId: string, formData: FormData) {
  return run(scoreId, formData, async (tx, c) => {
    await cancelActivity(tx, c, activityId);
  });
}

export async function winDeal(scoreId: string, formData: FormData) {
  return run(scoreId, formData, async (tx, c) => {
    const r = await moveToKind(tx, c, scoreId, "WON");
    await syncFeedback(tx, { organizationId: c.organizationId, companyId: r.companyId, scoreId: r.scoreId, kind: "WON" });
  });
}

export async function loseDeal(scoreId: string, formData: FormData) {
  return run(scoreId, formData, async (tx, c) => {
    const reason = String(formData.get("reason") ?? "") as LossReasonKey;
    if (!LOSS_REASONS.includes(reason)) throw new UserError("Escolha o motivo da perda.");
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const r = await moveToKind(tx, c, scoreId, "LOST", notes);
    await syncFeedback(tx, { organizationId: c.organizationId, companyId: r.companyId, scoreId: r.scoreId, kind: "LOST", lossReason: reason, lossNotes: notes });
  });
}

// Muda a etapa por uma etapa ABERTA do funil (ganha e perdida têm botões próprios,
// com motivo da perda).
export async function moveStage(scoreId: string, formData: FormData) {
  return run(scoreId, formData, async (tx, c) => {
    const key = String(formData.get("stage") ?? "");
    const pipeline = await getDefaultPipeline(tx, c.organizationId);
    const stage = pipeline.stages.find((s) => s.key === key);
    if (!stage) throw new UserError("Etapa inválida.");
    if (stage.kind === "LOST") throw new UserError("Use o botão Perdida para informar o motivo.");
    const r = await moveToStage(tx, c, scoreId, key);
    await syncFeedback(tx, { organizationId: c.organizationId, companyId: r.companyId, scoreId: r.scoreId, kind: r.kind });
  });
}

// ---- Leads ----

export async function newLead(formData: FormData) {
  const c = await requireCtx();
  let target = "/leads";
  try {
    const result = await withOrgContext(c.organizationId, (tx) =>
      createLead(tx, c, {
        name: String(formData.get("name") ?? ""),
        company: String(formData.get("company") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        email: String(formData.get("email") ?? ""),
        message: String(formData.get("message") ?? ""),
        originKey: String(formData.get("origin") ?? "outro"),
      }),
    );
    revalidatePath("/leads");
    revalidatePath("/pipeline");
    target = `/pipeline?abrir=${result.opportunityId}&owner=me`;
  } catch (err) {
    let message = "Não foi possível cadastrar o lead. Tente novamente.";
    if (err instanceof DuplicateLeadError || err instanceof LeadValidationError) message = err.message;
    else console.error("newLead failed", err);
    target = `/leads?erro=${encodeURIComponent(message)}`;
  }
  redirect(target);
}

// ---- Contatos ----

const LEGAL_BASES = ["LEGITIMATE_INTEREST", "CONSENT", "CONTRACT"] as const;

async function requireManager() {
  const c = await requireCtx();
  const m = await withOrgContext(c.organizationId, (tx) => tx.membership.findFirst({ where: { organizationId: c.organizationId, userId: c.userId ?? "" }, select: { role: true } }));
  if (!m || (m.role !== "OWNER" && m.role !== "ADMIN")) redirect("/contatos?erro=" + encodeURIComponent("Só donos e administradores podem fazer isso."));
  return c;
}

export async function setContactLegalBasis(contactId: string, formData: FormData) {
  const c = await requireCtx();
  const basis = String(formData.get("legalBasis") ?? "");
  const value = (LEGAL_BASES as readonly string[]).includes(basis) ? (basis as (typeof LEGAL_BASES)[number]) : null;
  const note = String(formData.get("legalBasisNote") ?? "").trim().slice(0, 300) || null;
  await withOrgContext(c.organizationId, (tx) => tx.contact.updateMany({ where: { id: contactId, organizationId: c.organizationId, anonymizedAt: null }, data: { legalBasis: value, legalBasisNote: note } }));
  revalidatePath("/contatos");
  redirect("/contatos?salvo=1");
}

// LGPD: anonimiza a pessoa (nome, e-mail, telefone e cargo somem), mantém a conta e a
// negociação. Não apaga a linha porque ela pode estar ligada a uma negociação.
export async function anonymizeContact(contactId: string) {
  const c = await requireManager();
  await withOrgContext(c.organizationId, (tx) =>
    tx.contact.updateMany({
      where: { id: contactId, organizationId: c.organizationId },
      data: { name: "Pessoa removida (LGPD)", jobTitle: null, email: null, phone: null, phoneE164: null, linkedinUrl: null, legalBasisNote: null, anonymizedAt: new Date(), isPrimary: false },
    }),
  );
  revalidatePath("/contatos");
  redirect("/contatos?salvo=1");
}
