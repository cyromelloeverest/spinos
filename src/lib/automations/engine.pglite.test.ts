import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";

const h = vi.hoisted(() => ({ prisma: null as unknown }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return h.prisma; } }));
vi.mock("@/lib/log-error", () => ({ logError: vi.fn() }));

import { createPrismaOnPglite } from "@/lib/db/pglite-harness";
import type { PrismaClient } from "@/generated/prisma/client";
import { createLead, DuplicateLeadError, LeadValidationError } from "@/lib/crm/leads";
import { moveToStage } from "@/lib/crm/opportunities";
import { runTimeAutomations } from "./engine";
import { defaultConfig } from "./recipes";

let db: PGlite;
let prisma: PrismaClient;
const NOW = new Date("2026-11-16T15:00:00Z"); // segunda 12:00 em Brasília

async function inOrg<T>(orgId: string, fn: (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // Fora daqui o cliente é superusuário (para montar o cenário); dentro, o papel restrito do app, com RLS.
    await tx.$executeRawUnsafe("SET LOCAL ROLE spinos_app");
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, true)`;
    return fn(tx);
  });
}
const ctx = (orgId: string, userId: string | null = "u1") => ({ organizationId: orgId, userId });
const enable = (orgId: string, key: string, config: object) => prisma.automation.create({ data: { organizationId: orgId, key, enabled: true, config } });

beforeAll(async () => {
  const r = await createPrismaOnPglite();
  db = r.db;
  prisma = r.prisma;
  h.prisma = prisma;
  for (const [id, email] of [["u1", "u1@x.com"], ["u2", "u2@x.com"], ["u3", "u3@x.com"]]) await prisma.user.create({ data: { id, email, name: id } });
  for (const org of ["A", "B", "C"]) {
    await prisma.organization.create({ data: { id: org, name: org } });
  }
  await prisma.membership.create({ data: { userId: "u1", organizationId: "A", role: "OWNER" } });
  await prisma.membership.create({ data: { userId: "u2", organizationId: "A", role: "MEMBER" } });
  await prisma.membership.create({ data: { userId: "u3", organizationId: "A", role: "ADMIN" } });
}, 60_000);
afterAll(async () => {
  await prisma.$disconnect();
  await db.close();
});

describe("cadastro de lead", () => {
  it("cria conta, contato, origem e negociação na primeira etapa, e quem cadastrou assume", async () => {
    const r = await inOrg("B", (tx) => createLead(tx, ctx("B"), { name: "Joana", company: "Padaria Sol", phone: "(11) 99999-0000", email: "JOANA@sol.com", originKey: "indicacao", message: "Quer abrir uma filial" }));
    const deal = await prisma.opportunity.findUniqueOrThrow({ where: { id: r.opportunityId }, include: { stage: true, account: { include: { contacts: true, origins: true } } } });
    expect(deal.stage.key).toBe("CONTATO_FEITO");
    expect(deal.ownerUserId).toBe("u1");
    expect(deal.title).toBe("Lead: Quer abrir uma filial");
    expect(deal.account.name).toBe("Padaria Sol");
    expect(deal.account.contacts[0]).toMatchObject({ name: "Joana", email: "joana@sol.com", isPrimary: true, phoneE164: "11999990000" });
    expect(deal.account.origins[0]).toMatchObject({ kind: "REFERRAL", channel: "indicacao", isFirstTouch: true });
  });

  it("recusa duplicata por telefone ou e-mail e dado incompleto", async () => {
    await expect(inOrg("B", (tx) => createLead(tx, ctx("B"), { name: "Outra", phone: "11 99999-0000", originKey: "site" }))).rejects.toBeInstanceOf(DuplicateLeadError);
    await expect(inOrg("B", (tx) => createLead(tx, ctx("B"), { name: "Outra", email: "joana@SOL.com", originKey: "site" }))).rejects.toBeInstanceOf(DuplicateLeadError);
    await expect(inOrg("B", (tx) => createLead(tx, ctx("B"), { name: "", phone: "11988887777", originKey: "site" }))).rejects.toBeInstanceOf(LeadValidationError);
    await expect(inOrg("B", (tx) => createLead(tx, ctx("B"), { name: "Sem contato", originKey: "site" }))).rejects.toBeInstanceOf(LeadValidationError);
    await expect(inOrg("B", (tx) => createLead(tx, ctx("B"), { name: "X", phone: "11988887777", originKey: "xyz" }))).rejects.toBeInstanceOf(LeadValidationError);
  });

  it("a mesma pessoa pode ser lead em outra organização (isolamento)", async () => {
    await expect(inOrg("C", (tx) => createLead(tx, ctx("C"), { name: "Joana", phone: "11999990000", originKey: "site" }))).resolves.toBeTruthy();
  });
});

describe("automações de evento", () => {
  it("rodízio: entrega os leads em sequência e guarda o cursor", async () => {
    await enable("A", "lead_distribution", { userIds: ["u1", "u2"], cursor: 0 });
    const owners: (string | null)[] = [];
    for (const [i, n] of ["a", "b", "c"].entries()) {
      const r = await inOrg("A", (tx) => createLead(tx, ctx("A", "u3"), { name: `Lead ${n}`, phone: `1190000000${i}`, originKey: "site" }));
      owners.push((await prisma.opportunity.findUniqueOrThrow({ where: { id: r.opportunityId } })).ownerUserId);
    }
    expect(owners).toEqual(["u1", "u2", "u1"]);
    const cfg = (await prisma.automation.findUniqueOrThrow({ where: { organizationId_key: { organizationId: "A", key: "lead_distribution" } } })).config as { cursor: number };
    expect(cfg.cursor).toBe(1);
  });

  it("proposta: agenda os follow-ups nos dias, uma vez só, mesmo repetindo o evento", async () => {
    await enable("A", "proposal_followup", { stageKeys: ["PROPOSTA_ENVIADA"], days: [2, 5] });
    const lead = await inOrg("A", (tx) => createLead(tx, ctx("A"), { name: "Cliente Proposta", phone: "11977776666", originKey: "site" }));
    await inOrg("A", (tx) => moveToStage(tx, ctx("A"), lead.opportunityId, "PROPOSTA_ENVIADA"));
    await inOrg("A", (tx) => moveToStage(tx, ctx("A"), lead.opportunityId, "PROPOSTA_ENVIADA")); // mesma etapa de novo
    const acts = await prisma.activity.findMany({ where: { opportunityId: lead.opportunityId, automation: "proposal_followup" }, orderBy: { dueAt: "asc" } });
    expect(acts).toHaveLength(2);
    expect(acts[0].title).toMatch(/2 dias/);
    const runs = await prisma.automationRun.count({ where: { opportunityId: lead.opportunityId, automationKey: "proposal_followup" } });
    expect(runs).toBe(2);
  });

  it("ganha e perdida: pós-venda e retomada", async () => {
    await enable("A", "won_onboarding", defaultConfig("won_onboarding"));
    await enable("A", "lost_reactivation", { afterDays: 30 });
    const won = await inOrg("A", (tx) => createLead(tx, ctx("A"), { name: "Vai Ganhar", phone: "11955554444", originKey: "site" }));
    const lost = await inOrg("A", (tx) => createLead(tx, ctx("A"), { name: "Vai Perder", phone: "11955553333", originKey: "site" }));
    await inOrg("A", (tx) => moveToStage(tx, ctx("A"), won.opportunityId, "VENDIDO"));
    await inOrg("A", (tx) => moveToStage(tx, ctx("A"), lost.opportunityId, "PERDIDO"));
    expect(await prisma.activity.count({ where: { opportunityId: won.opportunityId, automation: "won_onboarding" } })).toBe(3);
    expect(await prisma.activity.count({ where: { opportunityId: lost.opportunityId, automation: "lost_reactivation" } })).toBe(1);
  });

  it("tarefas por etapa só disparam na etapa configurada", async () => {
    await enable("A", "stage_tasks", { rules: [{ stageKey: "VISITA_AGENDADA", task: { type: "MEETING", title: "Preparar a visita", days: 1 } }] });
    const lead = await inOrg("A", (tx) => createLead(tx, ctx("A"), { name: "Visita", phone: "11944443333", originKey: "site" }));
    expect(await prisma.activity.count({ where: { opportunityId: lead.opportunityId, automation: "stage_tasks" } })).toBe(0);
    await inOrg("A", (tx) => moveToStage(tx, ctx("A"), lead.opportunityId, "VISITA_AGENDADA"));
    expect(await prisma.activity.count({ where: { opportunityId: lead.opportunityId, automation: "stage_tasks" } })).toBe(1);
  });

  it("uma automação que falha NÃO derruba a mudança de etapa", async () => {
    // Configuração inválida salva no banco: o motor volta ao padrão em vez de quebrar.
    await prisma.automation.update({ where: { organizationId_key: { organizationId: "A", key: "stage_tasks" } }, data: { config: { rules: "lixo" } } });
    const lead = await inOrg("A", (tx) => createLead(tx, ctx("A"), { name: "Resiliente", phone: "11933332222", originKey: "site" }));
    await expect(inOrg("A", (tx) => moveToStage(tx, ctx("A"), lead.opportunityId, "VISITA_AGENDADA"))).resolves.toMatchObject({ kind: "OPEN" });
    const s = await prisma.opportunity.findUniqueOrThrow({ where: { id: lead.opportunityId }, include: { stage: true } });
    expect(s.stage.key).toBe("VISITA_AGENDADA");
  });
});

describe("rotina de tempo", () => {
  it("lead sem resposta: tarefa ao responsável no prazo e à gestão depois, sem repetir", async () => {
    await enable("A", "lead_response", { slaMinutes: 30, escalateAfterMinutes: 30 });
    await prisma.automation.deleteMany({ where: { organizationId: "A", key: { in: ["lead_distribution", "proposal_followup", "won_onboarding", "lost_reactivation", "stage_tasks"] } } });
    // Os leads criados pelos testes acima já foram atendidos: só o "Parado" conta.
    await prisma.opportunity.updateMany({ where: { organizationId: "A" }, data: { firstResponseAt: new Date() } });
    const r = await inOrg("A", (tx) => createLead(tx, ctx("A"), { name: "Parado", phone: "11922221111", originKey: "site", ownerUserId: "u2" }));
    await prisma.opportunity.update({ where: { id: r.opportunityId }, data: { createdAt: new Date(NOW.getTime() - 45 * 60_000) } });

    const first = await inOrg("A", (tx) => runTimeAutomations(tx, "A", NOW));
    expect(first.created).toBe(1); // 45 min: passou do prazo (30) mas não do escalonamento (60)
    const later = new Date(NOW.getTime() + 30 * 60_000);
    const second = await inOrg("A", (tx) => runTimeAutomations(tx, "A", later));
    expect(second.created).toBe(2); // gestores: u1 (dono) e u3 (admin)
    const again = await inOrg("A", (tx) => runTimeAutomations(tx, "A", later));
    expect(again.created).toBe(0);

    const tasks = await prisma.activity.findMany({ where: { opportunityId: r.opportunityId, automation: "lead_response" } });
    expect(tasks.map((t) => t.ownerUserId).sort()).toEqual(["u1", "u2", "u3"]);
  });

  it("lead que já foi atendido não gera aviso; negociação sem próximo passo gera uma tarefa por episódio", async () => {
    await enable("A", "no_next_step", { afterDays: 2 });
    const ok = await inOrg("A", (tx) => createLead(tx, ctx("A"), { name: "Atendido", phone: "11911110000", originKey: "site" }));
    await prisma.opportunity.update({ where: { id: ok.opportunityId }, data: { createdAt: new Date(NOW.getTime() - 5 * 3600_000), firstResponseAt: new Date(), lastActionAt: new Date(NOW.getTime() - 3 * 24 * 3600_000), nextActivityAt: null } });
    const before = await prisma.activity.count({ where: { opportunityId: ok.opportunityId, automation: "lead_response" } });
    await inOrg("A", (tx) => runTimeAutomations(tx, "A", NOW));
    expect(await prisma.activity.count({ where: { opportunityId: ok.opportunityId, automation: "lead_response" } })).toBe(before);
    expect(await prisma.activity.count({ where: { opportunityId: ok.opportunityId, automation: "no_next_step" } })).toBe(1);
    await inOrg("A", (tx) => runTimeAutomations(tx, "A", NOW));
    expect(await prisma.activity.count({ where: { opportunityId: ok.opportunityId, automation: "no_next_step" } })).toBe(1);
  });

  it("não vaza para outra organização", async () => {
    const r = await inOrg("B", (tx) => runTimeAutomations(tx, "B", NOW));
    expect(r.created).toBe(0);
  });
});
