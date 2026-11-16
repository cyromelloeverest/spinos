import type { Prisma } from "@/generated/prisma/client";
import { logError } from "@/lib/log-error";
import { businessDueDate } from "@/lib/crm/dates";
import { scheduleActivity, type ActivityTypeKey } from "@/lib/crm/activities";
import { readConfig, isAutomationKey, type AutomationKey, type AutomationConfig } from "./recipes";

type Tx = Prisma.TransactionClient;
type Ctx = { organizationId: string; userId: string | null };

// Automação NUNCA impede a ação de quem usa o CRM. Cada receita roda dentro de um
// savepoint: se algo falhar, só o que a automação fez é desfeito, o erro vai pro log
// e a mudança de etapa (ou o que quer que tenha disparado) segue normalmente.
async function safely(tx: Tx, label: string, ctx: { organizationId: string }, fn: () => Promise<void>): Promise<void> {
  await tx.$executeRawUnsafe("SAVEPOINT crm_automation");
  try {
    await fn();
    await tx.$executeRawUnsafe("RELEASE SAVEPOINT crm_automation");
  } catch (err) {
    await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT crm_automation");
    await tx.$executeRawUnsafe("RELEASE SAVEPOINT crm_automation");
    logError(`automação falhou: ${label}`, err, { organizationId: ctx.organizationId });
  }
}

async function enabled(tx: Tx, organizationId: string): Promise<Partial<{ [K in AutomationKey]: AutomationConfig[K] }>> {
  const rows = await tx.automation.findMany({ where: { organizationId, enabled: true } });
  const out: Record<string, unknown> = {};
  for (const r of rows) if (isAutomationKey(r.key)) out[r.key] = readConfig(r.key, r.config);
  return out as Partial<{ [K in AutomationKey]: AutomationConfig[K] }>;
}

// Registra que a receita agiu nesse evento. Devolve false se já agiu (o dedupeKey é
// único): é isso que torna seguro repetir um evento ou rodar a rotina de tempo duas vezes.
async function claim(tx: Tx, organizationId: string, key: AutomationKey, dedupeKey: string, extra: { opportunityId?: string; summary?: string }): Promise<boolean> {
  const { count } = await tx.automationRun.createMany({
    data: [{ organizationId, automationKey: key, dedupeKey, opportunityId: extra.opportunityId ?? null, summary: extra.summary ?? null }],
    skipDuplicates: true,
  });
  return count > 0;
}

// Reivindica o evento e, só se for novo, cria a tarefa e a liga ao registro. O mesmo
// dedupeKey também vira o clientRequestId da atividade (segunda trava contra duplicata).
async function claimAndTask(
  tx: Tx,
  ctx: Ctx,
  key: AutomationKey,
  dedupeKey: string,
  opportunityId: string,
  summary: string,
  spec: { type: ActivityTypeKey; title: string; dueAt: Date; ownerUserId?: string | null },
): Promise<boolean> {
  if (!(await claim(tx, ctx.organizationId, key, dedupeKey, { opportunityId, summary }))) return false;
  const activity = await scheduleActivity(tx, ctx, { opportunityId, type: spec.type, title: spec.title, dueAt: spec.dueAt, automation: key, ownerUserId: spec.ownerUserId, clientRequestId: dedupeKey });
  await tx.automationRun.updateMany({ where: { organizationId: ctx.organizationId, dedupeKey }, data: { activityId: activity.id } });
  return true;
}

// ---- Eventos ----

export async function onStageChanged(tx: Tx, ctx: Ctx, input: { opportunityId: string; stageKey: string; stageKind: "OPEN" | "WON" | "LOST"; stageChangedAt: Date; now?: Date }) {
  const now = input.now ?? new Date();
  const on = await enabled(tx, ctx.organizationId);
  const episode = input.stageChangedAt.toISOString();

  if (on.stage_tasks) {
    const cfg = on.stage_tasks;
    for (const [i, rule] of cfg.rules.entries()) {
      if (rule.stageKey !== input.stageKey) continue;
      await safely(tx, "stage_tasks", ctx, async () => {
        await claimAndTask(tx, ctx, "stage_tasks", `stage_tasks:${input.opportunityId}:${episode}:${i}`, input.opportunityId, rule.task.title, { type: rule.task.type, title: rule.task.title, dueAt: businessDueDate(rule.task.days, now) });
      });
    }
  }

  if (on.proposal_followup && on.proposal_followup.stageKeys.includes(input.stageKey)) {
    const cfg = on.proposal_followup;
    for (const day of cfg.days) {
      await safely(tx, "proposal_followup", ctx, async () => {
        await claimAndTask(tx, ctx, "proposal_followup", `proposal_followup:${input.opportunityId}:${episode}:${day}`, input.opportunityId, `Follow-up de proposta (${day} dias)`, { type: "WHATSAPP", title: `Follow-up da proposta (${day} ${day === 1 ? "dia" : "dias"} depois)`, dueAt: businessDueDate(day, now) });
      });
    }
  }

  if (on.won_onboarding && input.stageKind === "WON") {
    for (const [i, spec] of on.won_onboarding.tasks.entries()) {
      await safely(tx, "won_onboarding", ctx, async () => {
        await claimAndTask(tx, ctx, "won_onboarding", `won_onboarding:${input.opportunityId}:${episode}:${i}`, input.opportunityId, spec.title, { type: spec.type, title: spec.title, dueAt: businessDueDate(spec.days, now) });
      });
    }
  }

  if (on.lost_reactivation && input.stageKind === "LOST") {
    await safely(tx, "lost_reactivation", ctx, async () => {
      await claimAndTask(tx, ctx, "lost_reactivation", `lost_reactivation:${input.opportunityId}:${episode}`, input.opportunityId, "Retomar contato", { type: "WHATSAPP", title: "Retomar o contato com quem não fechou", dueAt: businessDueDate(on.lost_reactivation!.afterDays, now) });
    });
  }
}

// Lead novo sem responsável: entrega à próxima pessoa do rodízio.
export async function onLeadCreated(tx: Tx, ctx: Ctx, opportunityId: string) {
  const on = await enabled(tx, ctx.organizationId);
  if (!on.lead_distribution || on.lead_distribution.userIds.length === 0) return;
  await safely(tx, "lead_distribution", ctx, async () => {
    const opp = await tx.opportunity.findFirstOrThrow({ where: { id: opportunityId, organizationId: ctx.organizationId }, select: { ownerUserId: true } });
    if (opp.ownerUserId) return;
    const cfg = on.lead_distribution!;
    // Só entra no rodízio quem ainda faz parte da equipe.
    const members = await tx.membership.findMany({ where: { organizationId: ctx.organizationId, userId: { in: cfg.userIds } }, select: { userId: true } });
    const valid = cfg.userIds.filter((id) => members.some((m) => m.userId === id));
    if (valid.length === 0) return;
    const pick = valid[cfg.cursor % valid.length];
    if (!(await claim(tx, ctx.organizationId, "lead_distribution", `lead_distribution:${opportunityId}`, { opportunityId, summary: `Entregue a ${pick}` }))) return;
    await tx.opportunity.update({ where: { id: opportunityId }, data: { ownerUserId: pick } });
    await tx.automation.update({ where: { organizationId_key: { organizationId: ctx.organizationId, key: "lead_distribution" } }, data: { config: { userIds: cfg.userIds, cursor: (cfg.cursor + 1) % Math.max(cfg.userIds.length, 1) } } });
  });
}

// ---- Rotina de tempo (chamada pelo cron a cada 5 minutos) ----

export async function runTimeAutomations(tx: Tx, organizationId: string, now: Date = new Date()): Promise<{ created: number }> {
  const ctx: Ctx = { organizationId, userId: null };
  const on = await enabled(tx, organizationId);
  let created = 0;

  if (on.lead_response) {
    const cfg = on.lead_response;
    await safely(tx, "lead_response", ctx, async () => {
      const overdueSince = new Date(now.getTime() - cfg.slaMinutes * 60_000);
      const leads = await tx.opportunity.findMany({
        where: {
          organizationId, status: "OPEN", firstResponseAt: null, createdAt: { lte: overdueSince },
          account: { is: { origins: { some: { isFirstTouch: true, kind: { not: "PROSPECTING" } } } } },
        },
        select: { id: true, ownerUserId: true, createdAt: true },
        take: 200,
      });
      const managers = leads.length ? await tx.membership.findMany({ where: { organizationId, role: { in: ["OWNER", "ADMIN"] } }, select: { userId: true } }) : [];
      for (const lead of leads) {
        if (lead.ownerUserId && (await claimAndTask(tx, ctx, "lead_response", `lead_response:${lead.id}:owner`, lead.id, "Prazo de primeiro atendimento vencido", { type: "CALL", title: "Atender o lead: o prazo de primeiro atendimento venceu", dueAt: now, ownerUserId: lead.ownerUserId }))) created++;
        const escalateAt = new Date(lead.createdAt.getTime() + (cfg.slaMinutes + cfg.escalateAfterMinutes) * 60_000);
        if (now >= escalateAt) {
          for (const m of managers) {
            if (m.userId === lead.ownerUserId) continue;
            if (await claimAndTask(tx, ctx, "lead_response", `lead_response:${lead.id}:mgr:${m.userId}`, lead.id, "Escalado para a gestão", { type: "TASK", title: "Lead parado sem atendimento: cobrar o responsável", dueAt: now, ownerUserId: m.userId })) created++;
          }
        }
      }
    });
  }

  if (on.no_next_step) {
    const cfg = on.no_next_step;
    await safely(tx, "no_next_step", ctx, async () => {
      const since = new Date(now.getTime() - cfg.afterDays * 24 * 60 * 60 * 1000);
      const stuck = await tx.opportunity.findMany({
        where: { organizationId, status: "OPEN", nextActivityAt: null, OR: [{ lastActionAt: { lte: since } }, { lastActionAt: null, stageChangedAt: { lte: since } }] },
        select: { id: true, lastActionAt: true, stageChangedAt: true },
        take: 200,
      });
      for (const o of stuck) {
        const episode = (o.lastActionAt ?? o.stageChangedAt).toISOString().slice(0, 10);
        if (await claimAndTask(tx, ctx, "no_next_step", `no_next_step:${o.id}:${episode}`, o.id, "Sem próximo passo", { type: "TASK", title: "Definir o próximo passo desta negociação", dueAt: now })) created++;
      }
    });
  }
  return { created };
}
