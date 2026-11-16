import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";

const h = vi.hoisted(() => ({ prisma: null as unknown }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return h.prisma; } }));
vi.mock("@/lib/log-error", () => ({ logError: vi.fn() }));

import { createPrismaOnPglite } from "@/lib/db/pglite-harness";
import type { PrismaClient } from "@/generated/prisma/client";
import { createLead } from "@/lib/crm/leads";
import { activationProgress, getActivationSteps } from "./activation";

let db: PGlite;
let prisma: PrismaClient;

async function inOrg<T>(orgId: string, fn: (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL ROLE spinos_app");
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, true)`;
    return fn(tx);
  });
}
const done = async (org: string) => Object.fromEntries((await inOrg(org, (tx) => getActivationSteps(tx, org))).map((s) => [s.key, s.done]));

beforeAll(async () => {
  const r = await createPrismaOnPglite();
  db = r.db;
  prisma = r.prisma;
  h.prisma = prisma;
  await prisma.user.createMany({ data: [{ id: "u1", email: "u1@x.com", name: "U1" }, { id: "u2", email: "u2@x.com", name: "U2" }] });
  await prisma.organization.create({ data: { id: "N", name: "Nova" } });
  await prisma.organization.create({ data: { id: "C", name: "Contábil Teste" } });
  await prisma.organizationPack.create({ data: { organizationId: "C", packKey: "contabilidade", packVersion: "1.0.0", snapshot: {} } });
}, 60_000);
afterAll(async () => {
  await prisma.$disconnect();
  await db.close();
});

describe("primeiros passos", () => {
  it("conta nova: nada feito, e o próximo passo é o perfil", async () => {
    const steps = await inOrg("N", (tx) => getActivationSteps(tx, "N"));
    expect(steps.map((s) => s.key)).toEqual(["perfil", "icp", "busca", "funil", "site", "conteudo", "equipe"]);
    expect(steps.every((s) => !s.done)).toBe(true);
    const p = activationProgress(steps);
    expect(p).toMatchObject({ done: 0, total: 6, complete: false });
    expect(p.next?.key).toBe("perfil");
  });

  it("cada passo acende sozinho a partir dos dados da conta", async () => {
    await prisma.organization.update({ where: { id: "N" }, data: { city: "Jundiaí", state: "SP", segment: "Serviços" } });
    expect((await done("N")).perfil).toBe(true);
    await prisma.iCP.create({ data: { organizationId: "N" } });
    expect((await done("N")).icp).toBe(true);
    await prisma.searchRun.create({ data: { organizationId: "N" } });
    expect((await done("N")).busca).toBe(true);
    await inOrg("N", (tx) => createLead(tx, { organizationId: "N", userId: null }, { name: "Primeiro Lead", company: "Empresa X", phone: "11911112222", originKey: "site" }));
    expect((await done("N")).funil).toBe(true);
    // Site só conta quando está PUBLICADO; rascunho não.
    const site = await prisma.site.create({ data: { organizationId: "N", name: "S", draft: {} } });
    expect((await done("N")).site).toBe(false);
    const v = await prisma.siteVersion.create({ data: { organizationId: "N", siteId: site.id, version: 1, content: {} } });
    await prisma.site.update({ where: { id: site.id }, data: { publishedVersionId: v.id } });
    expect((await done("N")).site).toBe(true);
    // A reserva de uso (corpo vazio) não conta como conteúdo gerado.
    await prisma.contentDraft.create({ data: { organizationId: "N", generationId: "g", kind: "ARTICLE", status: "DISCARDED", topic: "t", title: "(gerando)", body: "" } });
    expect((await done("N")).conteudo).toBe(false);
    await prisma.contentDraft.create({ data: { organizationId: "N", generationId: "g2", kind: "ARTICLE", topic: "t", title: "Real", body: "texto" } });
    expect((await done("N")).conteudo).toBe(true);
    const steps = await inOrg("N", (tx) => getActivationSteps(tx, "N"));
    expect(activationProgress(steps)).toMatchObject({ done: 6, total: 6, complete: true, next: null });
    // Convidar alguém é opcional: não bloqueia a conclusão e acende quando há mais de um membro.
    expect(steps.find((s) => s.key === "equipe")?.done).toBe(false);
    await prisma.membership.createMany({ data: [{ userId: "u1", organizationId: "N", role: "OWNER" }, { userId: "u2", organizationId: "N", role: "MEMBER" }] });
    expect((await done("N")).equipe).toBe(true);
  });

  it("nicho com registro profissional exige responsável e registro para o perfil contar", async () => {
    await prisma.organization.update({ where: { id: "C" }, data: { city: "Jundiaí", state: "SP", segment: "Contabilidade" } });
    expect((await done("C")).perfil).toBe(false);
    await prisma.organization.update({ where: { id: "C" }, data: { responsibleName: "Maria", professionalRegistration: "CRC 1SP1" } });
    expect((await done("C")).perfil).toBe(true);
  });

  it("não enxerga dados de outra organização", async () => {
    expect((await done("C")).funil).toBe(false);
    expect((await done("C")).icp).toBe(false);
  });
});
