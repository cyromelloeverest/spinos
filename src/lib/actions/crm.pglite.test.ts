import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";

const h = vi.hoisted(() => ({ prisma: null as unknown, orgId: "org-A", userId: "user-1", redirects: [] as string[] }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return h.prisma; } }));
vi.mock("@/lib/auth/current-org", () => ({ getCurrentOrganizationId: async () => h.orgId, getCurrentUserId: async () => h.userId }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    h.redirects.push(to);
    throw new Error(`REDIRECT:${to}`);
  },
}));

import { createPrismaOnPglite, enterAppRole, leaveAppRole } from "@/lib/db/pglite-harness";
import type { PrismaClient } from "@/generated/prisma/client";
import { getAttention } from "@/lib/crm/attention";
import { getDrawerData } from "@/lib/crm/drawer-data";
const crm = await import("./crm");
const { moveToPipeline } = await import("./pipeline");

let db: PGlite;
let prisma: PrismaClient;
let n = 0;

async function inOrg<T>(orgId: string, fn: (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, true)`;
    return fn(tx);
  });
}

// Chama a ação e devolve o destino do redirect (as ações sempre terminam em redirect).
async function call(fn: () => Promise<unknown>): Promise<URLSearchParams> {
  h.redirects.length = 0;
  await fn().catch((e: Error) => {
    if (!String(e.message).startsWith("REDIRECT:")) throw e;
  });
  return new URLSearchParams(h.redirects[h.redirects.length - 1].split("?")[1]);
}

function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

async function seedScoreInPipeline(orgId = "org-A") {
  n++;
  await leaveAppRole(db);
  const company = await prisma.company.create({ data: { name: `Empresa ${n}`, cnpj: `${String(2000 + n).padStart(14, "0")}` } });
  const icp = await prisma.iCP.findFirstOrThrow({ where: { organizationId: orgId } });
  const score = await prisma.opportunityScore.create({
    data: { organizationId: orgId, companyId: company.id, icpId: icp.id, score: 80, urgency: "ALTA", headline: `H${n}`, execSummary: "x", reasoning: "x", suggestedApproach: "x", commercialArguments: [], objections: [] },
  });
  await enterAppRole(db);
  h.orgId = orgId;
  await moveToPipeline(score.id).catch(() => {});
  return score;
}

async function dealOfScore(scoreId: string) {
  await leaveAppRole(db);
  try {
    const s = await prisma.opportunityScore.findUniqueOrThrow({ where: { id: scoreId }, include: { account: { include: { opportunities: { include: { activities: true } }, origins: true } } } });
    return { deal: s.account!.opportunities[0], origins: s.account!.origins, accountId: s.accountId! };
  } finally {
    await enterAppRole(db);
  }
}

beforeAll(async () => {
  const r = await createPrismaOnPglite();
  db = r.db;
  prisma = r.prisma;
  h.prisma = prisma;
  for (const [id, email] of [["user-1", "u1@x.com"], ["user-2", "u2@x.com"], ["user-3", "u3@x.com"]]) await prisma.user.create({ data: { id, email, name: id } });
  for (const id of ["org-A", "org-B"]) {
    await prisma.organization.create({ data: { id, name: id } });
    await prisma.iCP.create({ data: { organizationId: id } });
  }
  await prisma.membership.create({ data: { userId: "user-1", organizationId: "org-A", role: "OWNER" } });
  await prisma.membership.create({ data: { userId: "user-2", organizationId: "org-A", role: "MEMBER" } });
  await prisma.membership.create({ data: { userId: "user-3", organizationId: "org-B", role: "OWNER" } });
  await enterAppRole(db);
}, 60_000);
afterAll(async () => {
  await prisma.$disconnect();
  await db.close();
});
beforeEach(() => {
  h.orgId = "org-A";
  h.userId = "user-1";
});

const in2days = "2026-12-20T10:00";

describe("detalhes da negociação", () => {
  it("salva valor, recorrência, responsável e origem do lead", async () => {
    const s = await seedScoreInPipeline();
    const q = await call(() => crm.saveDetails(s.id, form({ expectedValue: "R$ 12.500,50", billing: "RECURRING", ownerUserId: "user-2", origin: "indicacao" })));
    expect(q.get("salvo")).toBe("1");
    const { deal, origins } = await dealOfScore(s.id);
    expect(deal).toMatchObject({ expectedValueBRL: 12500.5, billing: "RECURRING", ownerUserId: "user-2" });
    expect(origins.find((o) => o.isFirstTouch)).toMatchObject({ channel: "indicacao", kind: "REFERRAL" });
  });

  it("recusa valor inválido, origem inventada e responsável de fora da equipe, sem salvar nada", async () => {
    const s = await seedScoreInPipeline();
    expect((await call(() => crm.saveDetails(s.id, form({ expectedValue: "abc" })))).get("erro")).toMatch(/Valor previsto/);
    expect((await call(() => crm.saveDetails(s.id, form({ expectedValue: "10", origin: "xyz" })))).get("erro")).toMatch(/Origem/);
    expect((await call(() => crm.saveDetails(s.id, form({ expectedValue: "10", ownerUserId: "user-3" })))).get("erro")).toMatch(/equipe/);
    const { deal } = await dealOfScore(s.id);
    expect(deal.expectedValueBRL).toBeNull();
  });

  it("nota que ainda não está no pipeline pede para mover primeiro", async () => {
    await leaveAppRole(db);
    const company = await prisma.company.create({ data: { name: "Fora do funil", cnpj: "00000000009999" } });
    const icp = await prisma.iCP.findFirstOrThrow({ where: { organizationId: "org-A" } });
    const score = await prisma.opportunityScore.create({ data: { organizationId: "org-A", companyId: company.id, icpId: icp.id, score: 1, urgency: "BAIXA", headline: "h", execSummary: "x", reasoning: "x", suggestedApproach: "x", commercialArguments: [], objections: [] } });
    await enterAppRole(db);
    expect((await call(() => crm.saveDetails(score.id, form({ expectedValue: "1" })))).get("erro")).toMatch(/pipeline primeiro/);
  });
});

describe("próximos passos", () => {
  it("agenda, atualiza a próxima atividade da negociação e valida o formulário", async () => {
    const s = await seedScoreInPipeline();
    expect((await call(() => crm.addStep(s.id, form({ type: "CALL", title: "", dueAt: in2days })))).get("erro")).toMatch(/o que precisa/);
    expect((await call(() => crm.addStep(s.id, form({ type: "CALL", title: "Ligar", dueAt: "ontem" })))).get("erro")).toMatch(/data e hora/);
    expect((await call(() => crm.addStep(s.id, form({ type: "CALL", title: "Ligar para o decisor", dueAt: in2days })))).get("salvo")).toBe("1");
    const { deal } = await dealOfScore(s.id);
    expect(deal.activities).toHaveLength(1);
    expect(deal.nextActivityAt?.toISOString()).toBe("2026-12-20T13:00:00.000Z");
  });

  it("concluir exige o próximo passo: recusa sem ele, aceita com ele ou com a confirmação de que não há", async () => {
    const s = await seedScoreInPipeline();
    await call(() => crm.addStep(s.id, form({ type: "MEETING", title: "Reunião", dueAt: in2days })));
    let { deal } = await dealOfScore(s.id);
    const act = deal.activities[0];

    expect((await call(() => crm.finishStep(s.id, act.id, form({ outcome: "Foi bem" })))).get("erro")).toMatch(/próximo passo/);
    expect((await dealOfScore(s.id)).deal.activities[0].status).toBe("OPEN");

    await call(() => crm.finishStep(s.id, act.id, form({ outcome: "Foi bem", "next.type": "PROPOSAL", "next.title": "Enviar proposta", "next.dueAt": "2026-12-22T09:00" })));
    ({ deal } = await dealOfScore(s.id));
    expect(deal.activities.find((a) => a.id === act.id)).toMatchObject({ status: "DONE", outcome: "Foi bem" });
    expect(deal.activities.filter((a) => a.status === "OPEN")).toHaveLength(1);
    expect(deal.firstResponseAt).not.toBeNull();
    expect(deal.nextActivityAt?.toISOString()).toBe("2026-12-22T12:00:00.000Z");

    const next = deal.activities.find((a) => a.status === "OPEN")!;
    await call(() => crm.finishStep(s.id, next.id, form({ outcome: "Enviada", allowNoNext: "on" })));
    expect((await dealOfScore(s.id)).deal.nextActivityAt).toBeNull();
  });

  it("reagenda e cancela", async () => {
    const s = await seedScoreInPipeline();
    await call(() => crm.addStep(s.id, form({ type: "WHATSAPP", title: "Mandar mensagem", dueAt: in2days })));
    const act = (await dealOfScore(s.id)).deal.activities[0];
    await call(() => crm.moveStep(s.id, act.id, form({ dueAt: "2026-12-30T08:00" })));
    expect((await dealOfScore(s.id)).deal.nextActivityAt?.toISOString()).toBe("2026-12-30T11:00:00.000Z");
    await call(() => crm.dropStep(s.id, act.id, form({})));
    const { deal } = await dealOfScore(s.id);
    expect(deal.activities[0].status).toBe("CANCELED");
    expect(deal.nextActivityAt).toBeNull();
  });
});

describe("ganha e perdida", () => {
  it("ganha: fecha a negociação com o valor previsto e registra o Feedback", async () => {
    const s = await seedScoreInPipeline();
    await call(() => crm.saveDetails(s.id, form({ expectedValue: "3000" })));
    await call(() => crm.winDeal(s.id, form({})));
    const { deal } = await dealOfScore(s.id);
    expect(deal).toMatchObject({ status: "WON", wonValueBRL: 3000 });
    expect(deal.closedAt).not.toBeNull();
    await leaveAppRole(db);
    expect((await prisma.feedback.findUnique({ where: { opportunityScoreId: s.id } }))?.outcome).toBe("CONVERTED");
    await enterAppRole(db);
  });

  it("perdida pede o motivo e guarda a nota na negociação e no Feedback", async () => {
    const s = await seedScoreInPipeline();
    expect((await call(() => crm.loseDeal(s.id, form({})))).get("erro")).toMatch(/motivo/);
    await call(() => crm.loseDeal(s.id, form({ reason: "WRONG_FIT", notes: "Já tem contador" })));
    const { deal } = await dealOfScore(s.id);
    expect(deal).toMatchObject({ status: "LOST", lossNote: "Já tem contador" });
    await leaveAppRole(db);
    expect(await prisma.feedback.findUnique({ where: { opportunityScoreId: s.id } })).toMatchObject({ outcome: "WRONG_FIT", notes: "Já tem contador" });
    await enterAppRole(db);
  });
});

describe("faixa de avisos e gaveta", () => {
  it("conta atrasadas, de hoje e sem próximo passo, e filtra por pessoa", async () => {
    await leaveAppRole(db);
    await prisma.organization.create({ data: { id: "org-C", name: "org-C" } });
    await prisma.iCP.create({ data: { organizationId: "org-C" } });
    await prisma.membership.create({ data: { userId: "user-1", organizationId: "org-C", role: "OWNER" } });
    await enterAppRole(db);
    const s1 = await seedScoreInPipeline("org-C");
    const s2 = await seedScoreInPipeline("org-C");
    const s3 = await seedScoreInPipeline("org-C");
    h.orgId = "org-C";
    await leaveAppRole(db);
    const now = new Date("2026-11-16T15:00:00Z"); // segunda 12:00 em Brasília
    const d = async (id: string) => (await prisma.opportunityScore.findUniqueOrThrow({ where: { id }, include: { account: { include: { opportunities: true } } } })).account!.opportunities[0];
    const o1 = await d(s1.id), o2 = await d(s2.id), o3 = await d(s3.id);
    await prisma.opportunity.update({ where: { id: o2.id }, data: { ownerUserId: "user-2", expectedValueBRL: 1000 } });
    await prisma.opportunity.update({ where: { id: o1.id }, data: { ownerUserId: "user-1", expectedValueBRL: 500 } });
    await prisma.opportunity.update({ where: { id: o3.id }, data: { ownerUserId: "user-1" } });
    await prisma.activity.create({ data: { organizationId: "org-C", type: "CALL", title: "atrasada", dueAt: new Date("2026-11-14T12:00:00Z"), opportunityId: o1.id, accountId: o1.accountId, ownerUserId: "user-1" } });
    await prisma.activity.create({ data: { organizationId: "org-C", type: "CALL", title: "hoje", dueAt: new Date("2026-11-16T20:00:00Z"), opportunityId: o2.id, accountId: o2.accountId, ownerUserId: "user-2" } });
    await prisma.opportunity.update({ where: { id: o1.id }, data: { nextActivityAt: new Date("2026-11-14T12:00:00Z") } });
    await prisma.opportunity.update({ where: { id: o2.id }, data: { nextActivityAt: new Date("2026-11-16T20:00:00Z") } });

    const all = await inOrg("org-C", (tx) => getAttention(tx, "org-C", null, now));
    expect(all).toMatchObject({ overdue: 1, today: 1, noNextStep: 1, openCount: 3, openValueBRL: 1500 });
    const mine = await inOrg("org-C", (tx) => getAttention(tx, "org-C", "user-1", now));
    expect(mine).toMatchObject({ overdue: 1, today: 0, noNextStep: 1, openCount: 2, openValueBRL: 500 });
  });

  it("a gaveta traz contato, etapas, atividades, equipe e a origem; e não vaza dado de outra organização", async () => {
    const s = await seedScoreInPipeline();
    await call(() => crm.saveDetails(s.id, form({ expectedValue: "10", origin: "site" })));
    const data = await inOrg("org-A", (tx) => getDrawerData(tx, "org-A", s.id));
    expect(data?.deal?.stage.key).toBe("CONTATO_FEITO");
    expect(data?.originChannel).toBe("site");
    expect(data?.stages).toHaveLength(5);
    expect(data?.members.map((m) => m.id).sort()).toEqual(["user-1", "user-2"]);
    expect(await inOrg("org-B", (tx) => getDrawerData(tx, "org-B", s.id))).toBeNull();
  });
});
