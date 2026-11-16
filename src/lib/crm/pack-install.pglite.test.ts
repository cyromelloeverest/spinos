import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";

const h = vi.hoisted(() => ({ prisma: null as unknown }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return h.prisma; } }));
vi.mock("@/lib/log-error", () => ({ logError: vi.fn() }));

import { createPrismaOnPglite } from "@/lib/db/pglite-harness";
import type { PrismaClient } from "@/generated/prisma/client";
import { installPack, getInstalledPack, PackNotFoundError } from "./pack-install";
import { createLead } from "./leads";
import { moveToStage } from "./opportunities";
import { getDefaultPipeline } from "./pipeline-config";

let db: PGlite;
let prisma: PrismaClient;

async function inOrg<T>(orgId: string, fn: (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL ROLE spinos_app");
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, true)`;
    return fn(tx);
  });
}

beforeAll(async () => {
  const r = await createPrismaOnPglite();
  db = r.db;
  prisma = r.prisma;
  h.prisma = prisma;
  await prisma.user.create({ data: { id: "u1", email: "u1@x.com", name: "Maria Souza" } });
  for (const id of ["P", "Q", "R"]) await prisma.organization.create({ data: { id, name: `Org ${id}` } });
  await prisma.membership.create({ data: { userId: "u1", organizationId: "P", role: "OWNER" } });
}, 60_000);
afterAll(async () => {
  await prisma.$disconnect();
  await db.close();
});

describe("installPack", () => {
  it("instala funil, etapas, automações recomendadas e guarda a cópia do pacote", async () => {
    await inOrg("P", (tx) => installPack(tx, "P", "contabilidade"));
    const stages = await prisma.stage.findMany({ where: { organizationId: "P" }, orderBy: { position: "asc" } });
    expect(stages.map((s) => `${s.key}:${s.kind}`)).toEqual(["PRIMEIRO_CONTATO:OPEN", "DIAGNOSTICO:OPEN", "PROPOSTA:OPEN", "NEGOCIACAO:OPEN", "CLIENTE:WON", "PERDIDO:LOST"]);
    expect(await prisma.pipeline.count({ where: { organizationId: "P", isDefault: true } })).toBe(1);

    const autos = await prisma.automation.findMany({ where: { organizationId: "P" } });
    const on = autos.filter((a) => a.enabled).map((a) => a.key).sort();
    expect(on).toEqual(["lead_response", "lost_reactivation", "no_next_step", "proposal_followup", "stage_tasks", "won_onboarding"]);
    expect(autos.find((a) => a.key === "lead_distribution")?.enabled).toBe(false);

    const installed = await inOrg("P", (tx) => getInstalledPack(tx, "P"));
    expect(installed?.key).toBe("contabilidade");
    expect(installed?.messages.length).toBeGreaterThan(5);
  });

  it("o funil do pacote funciona de ponta a ponta: lead entra na 1ª etapa, proposta agenda follow-ups, cliente agenda pós-venda", async () => {
    const lead = await inOrg("P", (tx) => createLead(tx, { organizationId: "P", userId: "u1" }, { name: "Dono da Padaria", company: "Padaria Sol", phone: "11999991111", originKey: "indicacao" }));
    const deal = await prisma.opportunity.findUniqueOrThrow({ where: { id: lead.opportunityId }, include: { stage: true } });
    expect(deal.stage.key).toBe("PRIMEIRO_CONTATO");

    await inOrg("P", (tx) => moveToStage(tx, { organizationId: "P", userId: "u1" }, lead.opportunityId, "DIAGNOSTICO"));
    expect(await prisma.activity.count({ where: { opportunityId: lead.opportunityId, automation: "stage_tasks" } })).toBe(1);

    await inOrg("P", (tx) => moveToStage(tx, { organizationId: "P", userId: "u1" }, lead.opportunityId, "PROPOSTA"));
    expect(await prisma.activity.count({ where: { opportunityId: lead.opportunityId, automation: "proposal_followup" } })).toBe(3);

    await inOrg("P", (tx) => moveToStage(tx, { organizationId: "P", userId: "u1" }, lead.opportunityId, "CLIENTE"));
    expect(await prisma.activity.count({ where: { opportunityId: lead.opportunityId, automation: "won_onboarding" } })).toBe(3);
    expect((await prisma.opportunity.findUniqueOrThrow({ where: { id: lead.opportunityId } })).status).toBe("WON");
  });

  it("recusa organização que já tem negociações, e pacote desconhecido", async () => {
    await expect(inOrg("P", (tx) => installPack(tx, "P", "contabilidade"))).rejects.toThrow(/negociações/);
    await expect(inOrg("Q", (tx) => installPack(tx, "Q", "nao-existe"))).rejects.toBeInstanceOf(PackNotFoundError);
  });

  it("não vaza para outra organização: a Q continua sem pacote e com o funil genérico", async () => {
    expect(await inOrg("Q", (tx) => getInstalledPack(tx, "Q"))).toBeNull();
    const pipeline = await inOrg("Q", (tx) => getDefaultPipeline(tx, "Q"));
    expect(pipeline.stages.map((s) => s.key)).toEqual(["CONTATO_FEITO", "VISITA_AGENDADA", "PROPOSTA_ENVIADA", "VENDIDO", "PERDIDO"]);
  });

  it("cópia gravada com formato inválido não quebra a tela: devolve null", async () => {
    await prisma.organizationPack.create({ data: { organizationId: "R", packKey: "contabilidade", packVersion: "0.0.1", snapshot: { qualquer: "coisa" } } });
    expect(await inOrg("R", (tx) => getInstalledPack(tx, "R"))).toBeNull();
  });
});
