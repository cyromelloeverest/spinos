import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";

// Teste de integração: Prisma de verdade, schema e RLS reais (todas as migrações
// aplicadas num Postgres em memória), no papel restrito do app. Não é mock.
const h = vi.hoisted(() => ({ prisma: null as unknown, orgId: "org-A", userId: "user-1" }));

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return h.prisma;
  },
}));
vi.mock("@/lib/auth/current-org", () => ({
  getCurrentOrganizationId: async () => h.orgId,
  getCurrentUserId: async () => h.userId,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { createPrismaOnPglite, enterAppRole, leaveAppRole } from "@/lib/db/pglite-harness";
import type { PrismaClient } from "@/generated/prisma/client";
const { moveToPipeline, setStage, dismissOpportunity } = await import("./pipeline");

let db: PGlite;
let prisma: PrismaClient;
let n = 0;

async function seedScore(orgId: string, opts: { withAccount?: boolean } = {}) {
  n++;
  const company = await prisma.company.create({ data: { name: `Empresa ${n}`, cnpj: `${String(n).padStart(14, "0")}` } });
  const icp = await prisma.iCP.findFirst({ where: { organizationId: orgId } });
  const score = await prisma.opportunityScore.create({
    data: {
      organizationId: orgId, companyId: company.id, icpId: icp!.id, score: 80, urgency: "ALTA", headline: `Manchete ${n}`,
      execSummary: "x", reasoning: "x", suggestedApproach: "x", commercialArguments: [], objections: [],
    },
  });
  if (opts.withAccount) {
    const account = await prisma.account.create({ data: { organizationId: orgId, companyId: company.id, name: company.name } });
    await prisma.opportunityScore.update({ where: { id: score.id }, data: { accountId: account.id } });
  }
  return score;
}

async function asSeeder<T>(fn: () => Promise<T>): Promise<T> {
  await leaveAppRole(db);
  try {
    return await fn();
  } finally {
    await enterAppRole(db);
  }
}

async function state(scoreId: string) {
  return asSeeder(async () => {
    const score = await prisma.opportunityScore.findUniqueOrThrow({ where: { id: scoreId }, include: { account: { include: { opportunities: { include: { stage: true, stageEvents: true } } } } } });
    const feedback = await prisma.feedback.findUnique({ where: { opportunityScoreId: scoreId } });
    const opp = score.account?.opportunities[0] ?? null;
    return { score, account: score.account, opp, feedback };
  });
}

beforeAll(async () => {
  const r = await createPrismaOnPglite();
  db = r.db;
  prisma = r.prisma;
  h.prisma = prisma;
  await prisma.user.create({ data: { id: "user-1", email: "user1@example.com", name: "Usuária Um" } });
  for (const id of ["org-A", "org-B"]) {
    await prisma.organization.create({ data: { id, name: id } });
    await prisma.iCP.create({ data: { organizationId: id } });
  }
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

describe("moveToPipeline", () => {
  it("cria a conta (se faltar), entra na primeira etapa aberta e marca a conta como em contato", async () => {
    const score = await asSeeder(() => seedScore("org-A"));
    await moveToPipeline(score.id);

    const s = await state(score.id);
    expect(s.account?.lifecycle).toBe("ENGAGED");
    expect(s.opp?.stage.key).toBe("CONTATO_FEITO");
    expect(s.opp?.status).toBe("OPEN");
    expect(s.opp?.title).toBe(score.headline);
    expect(s.opp?.stageEvents).toHaveLength(1);
    expect(s.opp?.lastActionByUserId).toBe("user-1");
  });

  it("é seguro repetir: não cria uma segunda negociação", async () => {
    const score = await asSeeder(() => seedScore("org-A", { withAccount: true }));
    await moveToPipeline(score.id);
    await moveToPipeline(score.id);
    const byCompany = await asSeeder(() => prisma.opportunity.count({ where: { account: { companyId: score.companyId } } }));
    expect(byCompany).toBe(1);
  });
});

describe("setStage — etapa, ciclo de vida e Feedback", () => {
  it("VENDIDO: ganha, fecha, vira cliente e grava Feedback CONVERTED", async () => {
    const score = await asSeeder(() => seedScore("org-A"));
    await setStage(score.id, "VENDIDO");
    const s = await state(score.id);
    expect(s.opp?.status).toBe("WON");
    expect(s.opp?.closedAt).not.toBeNull();
    expect(s.account?.lifecycle).toBe("CUSTOMER");
    expect(s.feedback?.outcome).toBe("CONVERTED");
  });

  it("PERDIDO com motivo e nota; PERDIDO sem motivo cai em NOT_INTERESTED; nota em branco vira null", async () => {
    const a = await asSeeder(() => seedScore("org-A"));
    await setStage(a.id, "PERDIDO", "WRONG_FIT", "Não tinha orçamento nesse ciclo.");
    let s = await state(a.id);
    expect(s.opp?.status).toBe("LOST");
    expect(s.account?.lifecycle).toBe("LOST");
    expect(s.feedback).toMatchObject({ outcome: "WRONG_FIT", notes: "Não tinha orçamento nesse ciclo." });

    const b = await asSeeder(() => seedScore("org-A"));
    await setStage(b.id, "PERDIDO");
    s = await state(b.id);
    expect(s.feedback?.outcome).toBe("NOT_INTERESTED");

    const c = await asSeeder(() => seedScore("org-A"));
    await setStage(c.id, "PERDIDO", "NO_RESPONSE", "   ");
    s = await state(c.id);
    expect(s.feedback).toMatchObject({ outcome: "NO_RESPONSE", notes: null });
  });

  it("voltar de um estágio terminal reabre a negociação, apaga o Feedback e registra o histórico", async () => {
    const score = await asSeeder(() => seedScore("org-A"));
    await setStage(score.id, "VENDIDO");
    await setStage(score.id, "VISITA_AGENDADA");
    const s = await state(score.id);
    expect(s.opp?.status).toBe("OPEN");
    expect(s.opp?.closedAt).toBeNull();
    expect(s.opp?.stage.key).toBe("VISITA_AGENDADA");
    expect(s.account?.lifecycle).toBe("ENGAGED");
    expect(s.feedback).toBeNull();
    expect(s.opp?.stageEvents).toHaveLength(2);
  });

  it("mesma etapa de novo não gera histórico novo", async () => {
    const score = await asSeeder(() => seedScore("org-A"));
    await setStage(score.id, "PROPOSTA_ENVIADA");
    await setStage(score.id, "PROPOSTA_ENVIADA");
    const s = await state(score.id);
    expect(s.opp?.stageEvents).toHaveLength(1);
  });

  it("NOVA (coluna 'Oportunidades') apaga a negociação e volta a conta para alvo, sem Feedback", async () => {
    const score = await asSeeder(() => seedScore("org-A"));
    await setStage(score.id, "VENDIDO");
    await setStage(score.id, "NOVA");
    const s = await state(score.id);
    expect(s.opp).toBeNull();
    expect(s.account?.lifecycle).toBe("TARGET");
    expect(s.feedback).toBeNull();
  });

  it("etapa desconhecida falha e não deixa nada pela metade", async () => {
    const score = await asSeeder(() => seedScore("org-A"));
    await expect(setStage(score.id, "INVENTADA")).rejects.toThrow(/Etapa desconhecida/);
    const s = await state(score.id);
    expect(s.opp).toBeNull();
  });
});

describe("dismissOpportunity", () => {
  it("descarta a nota e a conta", async () => {
    const score = await asSeeder(() => seedScore("org-A"));
    await dismissOpportunity(score.id);
    const s = await state(score.id);
    expect(s.score.status).toBe("DISMISSED");
    expect(s.account?.lifecycle).toBe("DISMISSED");
  });
});

describe("isolamento entre organizações", () => {
  it("a organização A não consegue mover nem descartar a oportunidade da B", async () => {
    const other = await asSeeder(() => seedScore("org-B"));
    h.orgId = "org-A";
    await expect(setStage(other.id, "VENDIDO")).rejects.toThrow();
    await expect(moveToPipeline(other.id)).rejects.toThrow();
    await expect(dismissOpportunity(other.id)).rejects.toThrow();
    const s = await state(other.id);
    expect(s.opp).toBeNull();
    expect(s.score.status).toBe("NEW");
  });

  it("organização nova sem funil recebe o funil padrão sozinha", async () => {
    await asSeeder(async () => {
      await prisma.organization.create({ data: { id: "org-C", name: "org-C" } });
      await prisma.iCP.create({ data: { organizationId: "org-C" } });
    });
    h.orgId = "org-C";
    const score = await asSeeder(() => seedScore("org-C"));
    await setStage(score.id, "CONTATO_FEITO");
    const stages = await asSeeder(() => prisma.stage.count({ where: { organizationId: "org-C" } }));
    expect(stages).toBe(5);
  });
});
