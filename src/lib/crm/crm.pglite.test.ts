import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaOnPglite, enterAppRole, leaveAppRole } from "@/lib/db/pglite-harness";
import { ensureAccountForCompany, ensureDecisionMakerContact, savePrimaryContact, untouchedScoresWhere, inProgressScoresWhere } from "./accounts";
import { getDefaultPipeline } from "./pipeline-config";

let db: PGlite;
let prisma: PrismaClient;
let n = 0;

// Roda dentro do contexto de uma organização, no papel restrito (como o app).
async function inOrg<T>(orgId: string, fn: (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<T>): Promise<T> {
  await enterAppRole(db);
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, true)`;
      return fn(tx);
    });
  } finally {
    await leaveAppRole(db);
  }
}

async function seedScore(orgId: string, status: "NEW" | "DISMISSED" = "NEW") {
  n++;
  const company = await prisma.company.create({ data: { name: `Empresa ${n}`, cnpj: `${String(1000 + n).padStart(14, "0")}` } });
  const icp = await prisma.iCP.findFirstOrThrow({ where: { organizationId: orgId } });
  return prisma.opportunityScore.create({
    data: { organizationId: orgId, companyId: company.id, icpId: icp.id, score: 70, urgency: "MEDIA", headline: `H${n}`, execSummary: "x", reasoning: "x", suggestedApproach: "x", commercialArguments: [], objections: [], status },
  });
}

beforeAll(async () => {
  const r = await createPrismaOnPglite();
  db = r.db;
  prisma = r.prisma;
  for (const id of ["org-A", "org-B"]) {
    await prisma.organization.create({ data: { id, name: id } });
    await prisma.iCP.create({ data: { organizationId: id } });
  }
}, 60_000);

afterAll(async () => {
  await prisma.$disconnect();
  await db.close();
});

describe("ensureAccountForCompany", () => {
  it("cria a conta com a origem de prospecção e reaproveita na segunda chamada", async () => {
    const score = await seedScore("org-A");
    const id1 = await inOrg("org-A", (tx) => ensureAccountForCompany(tx, { organizationId: "org-A", companyId: score.companyId }));
    const id2 = await inOrg("org-A", (tx) => ensureAccountForCompany(tx, { organizationId: "org-A", companyId: score.companyId }));
    expect(id2).toBe(id1);
    const origins = await prisma.origin.findMany({ where: { accountId: id1 } });
    expect(origins).toHaveLength(1);
    expect(origins[0]).toMatchObject({ kind: "PROSPECTING", isFirstTouch: true });
  });

  it("a mesma empresa vira contas separadas em organizações diferentes", async () => {
    const score = await seedScore("org-A");
    const a = await inOrg("org-A", (tx) => ensureAccountForCompany(tx, { organizationId: "org-A", companyId: score.companyId }));
    const b = await inOrg("org-B", (tx) => ensureAccountForCompany(tx, { organizationId: "org-B", companyId: score.companyId }));
    expect(a).not.toBe(b);
  });
});

describe("filtros de listas", () => {
  it("'ainda não trabalhadas' exclui descartadas e as que já têm negociação; 'em andamento' inclui as abertas", async () => {
    const fresh = await seedScore("org-A");
    const dismissed = await seedScore("org-A", "DISMISSED");
    const withDeal = await seedScore("org-A");
    const won = await seedScore("org-A");

    await inOrg("org-A", async (tx) => {
      const pipeline = await getDefaultPipeline(tx, "org-A");
      for (const [score, stageKey] of [[withDeal, "PROPOSTA_ENVIADA"], [won, "VENDIDO"]] as const) {
        const accountId = await ensureAccountForCompany(tx, { organizationId: "org-A", companyId: score.companyId });
        await tx.opportunityScore.update({ where: { id: score.id }, data: { accountId } });
        const stage = pipeline.stages.find((s) => s.key === stageKey)!;
        await tx.opportunity.create({
          data: { organizationId: "org-A", accountId, pipelineId: pipeline.id, stageId: stage.id, title: "t", status: stage.kind === "WON" ? "WON" : "OPEN" },
        });
      }
    });

    const ids = async (where: ReturnType<typeof untouchedScoresWhere>) =>
      (await inOrg("org-A", (tx) => tx.opportunityScore.findMany({ where, select: { id: true } }))).map((r) => r.id);

    const untouched = await ids(untouchedScoresWhere("org-A"));
    expect(untouched).toContain(fresh.id);
    expect(untouched).not.toContain(dismissed.id);
    expect(untouched).not.toContain(withDeal.id);
    expect(untouched).not.toContain(won.id);

    const inProgress = await ids(inProgressScoresWhere("org-A"));
    expect(inProgress).toContain(fresh.id);
    expect(inProgress).toContain(withDeal.id);
    expect(inProgress).not.toContain(won.id);
    expect(inProgress).not.toContain(dismissed.id);
  });
});

describe("contatos", () => {
  async function newAccount() {
    const score = await seedScore("org-A");
    return inOrg("org-A", (tx) => ensureAccountForCompany(tx, { organizationId: "org-A", companyId: score.companyId }));
  }

  it("decisor da IA vira contato 'decisor' uma vez só", async () => {
    const accountId = await newAccount();
    for (let i = 0; i < 2; i++) await inOrg("org-A", (tx) => ensureDecisionMakerContact(tx, { organizationId: "org-A", accountId, name: "  Carlos Souza ", jobTitle: "Diretor" }));
    const contacts = await prisma.contact.findMany({ where: { accountId } });
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({ name: "Carlos Souza", jobTitle: "Diretor", decisionRole: "decisor", isPrimary: false });
  });

  it("salvar o formulário promove o decisor de mesmo nome a principal em vez de duplicar", async () => {
    const accountId = await newAccount();
    await inOrg("org-A", (tx) => ensureDecisionMakerContact(tx, { organizationId: "org-A", accountId, name: "Maria Lima" }));
    await inOrg("org-A", (tx) => savePrimaryContact(tx, { organizationId: "org-A", accountId, name: "maria lima", phone: "11999990000", email: null }));
    const contacts = await prisma.contact.findMany({ where: { accountId } });
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({ isPrimary: true, phone: "11999990000" });
  });

  it("atualiza o principal existente; formulário vazio remove o principal e solta a negociação", async () => {
    const accountId = await newAccount();
    await inOrg("org-A", (tx) => savePrimaryContact(tx, { organizationId: "org-A", accountId, name: "Ana", phone: null, email: "ana@x.com" }));
    await inOrg("org-A", (tx) => savePrimaryContact(tx, { organizationId: "org-A", accountId, name: "Ana Paula", phone: "1", email: "ana@x.com" }));
    let contacts = await prisma.contact.findMany({ where: { accountId } });
    expect(contacts).toHaveLength(1);
    expect(contacts[0].name).toBe("Ana Paula");

    const pipeline = await inOrg("org-A", (tx) => getDefaultPipeline(tx, "org-A"));
    const opp = await prisma.opportunity.create({
      data: { organizationId: "org-A", accountId, primaryContactId: contacts[0].id, pipelineId: pipeline.id, stageId: pipeline.stages[0].id, title: "t" },
    });
    await inOrg("org-A", (tx) => savePrimaryContact(tx, { organizationId: "org-A", accountId, name: null, phone: null, email: null }));
    contacts = await prisma.contact.findMany({ where: { accountId } });
    expect(contacts).toHaveLength(0);
    expect((await prisma.opportunity.findUniqueOrThrow({ where: { id: opp.id } })).primaryContactId).toBeNull();
  });
});

describe("exclusão da organização (LGPD)", () => {
  it("apagar a organização leva junto contas, contatos, negociações, histórico e origens", async () => {
    await prisma.organization.create({ data: { id: "org-X", name: "org-X" } });
    await prisma.iCP.create({ data: { organizationId: "org-X" } });
    const score = await seedScore("org-X");
    await inOrg("org-X", async (tx) => {
      const pipeline = await getDefaultPipeline(tx, "org-X");
      const accountId = await ensureAccountForCompany(tx, { organizationId: "org-X", companyId: score.companyId });
      await savePrimaryContact(tx, { organizationId: "org-X", accountId, name: "Fulano", phone: null, email: null });
      const contact = await tx.contact.findFirstOrThrow({ where: { accountId } });
      const opp = await tx.opportunity.create({ data: { organizationId: "org-X", accountId, primaryContactId: contact.id, pipelineId: pipeline.id, stageId: pipeline.stages[0].id, title: "t" } });
      await tx.opportunityStageEvent.create({ data: { organizationId: "org-X", opportunityId: opp.id, toStageId: pipeline.stages[0].id } });
    });
    await prisma.organization.delete({ where: { id: "org-X" } });
    for (const table of ["accounts", "contacts", "opportunities", "opportunity_stage_events", "origins", "pipelines", "stages"]) {
      const r = await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE "organizationId" = 'org-X'`);
      expect((r.rows[0] as { n: number }).n).toBe(0);
    }
  });
});
