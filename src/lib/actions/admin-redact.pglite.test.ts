import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";

const h = vi.hoisted(() => ({ prisma: null as unknown }));
vi.mock("@/lib/prisma-admin", () => ({ get prismaAdmin() { return h.prisma; } }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return h.prisma; } }));
vi.mock("@/lib/auth/current-org", () => ({ isCurrentUserSuperAdmin: async () => true, getCurrentUserId: async () => "admin-1" }));
vi.mock("@/lib/audit/log", () => ({ logSecurityEvent: vi.fn() }));
vi.mock("@/lib/invite-email", () => ({ sendInviteEmail: vi.fn(), INVITE_TTL_MS: 1 }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); } }));

import { createPrismaOnPglite } from "@/lib/db/pglite-harness";
import type { PrismaClient } from "@/generated/prisma/client";
const { redactThirdPartyData } = await import("./admin");

let db: PGlite;
let prisma: PrismaClient;

beforeAll(async () => {
  const r = await createPrismaOnPglite();
  db = r.db;
  prisma = r.prisma;
  h.prisma = prisma;
}, 60_000);
afterAll(async () => {
  await prisma.$disconnect();
  await db.close();
});

describe("redactThirdPartyData (pedido de remoção de dado de terceiro)", () => {
  it("anonimiza os contatos da conta e apaga o decisor da IA, mantendo conta, empresa e nota", async () => {
    await prisma.organization.create({ data: { id: "o1", name: "Org 1" } });
    const icp = await prisma.iCP.create({ data: { organizationId: "o1" } });
    const company = await prisma.company.create({ data: { name: "Alvo Ltda", cnpj: "00000000000199" } });
    const account = await prisma.account.create({ data: { organizationId: "o1", companyId: company.id, name: "Alvo Ltda" } });
    const score = await prisma.opportunityScore.create({
      data: { organizationId: "o1", companyId: company.id, icpId: icp.id, accountId: account.id, score: 80, urgency: "ALTA", headline: "h", execSummary: "x", reasoning: "x", suggestedApproach: "x", commercialArguments: [], objections: [], decisionMakerName: "João da Silva" },
    });
    await prisma.contact.create({ data: { organizationId: "o1", accountId: account.id, name: "João da Silva", email: "joao@alvo.com", phone: "11999", jobTitle: "Diretor", isPrimary: true } });

    await redactThirdPartyData(score.id);

    const s = await prisma.opportunityScore.findUniqueOrThrow({ where: { id: score.id } });
    expect(s.decisionMakerName).toBeNull();
    expect(s.score).toBe(80);
    const c = await prisma.contact.findFirstOrThrow({ where: { accountId: account.id } });
    expect(c).toMatchObject({ name: "Pessoa removida (LGPD)", email: null, phone: null, jobTitle: null });
    expect(c.anonymizedAt).not.toBeNull();
    expect(await prisma.account.count({ where: { id: account.id } })).toBe(1);
  });
});
