import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";

const h = vi.hoisted(() => ({ prisma: null as unknown }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return h.prisma; } }));
vi.mock("@/lib/log-error", () => ({ logError: vi.fn() }));

import { createPrismaOnPglite } from "@/lib/db/pglite-harness";
import type { PrismaClient } from "@/generated/prisma/client";
import { createLead } from "@/lib/crm/leads";
import { anonymizeContactData, contactDataExport } from "@/lib/crm/privacy";
import { runRetention, RETENTION } from "./retention";

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
  for (const id of ["A", "B"]) await prisma.organization.create({ data: { id, name: `Org ${id}` } });
}, 60_000);
afterAll(async () => {
  await prisma.$disconnect();
  await db.close();
});

describe("LGPD: eliminar uma pessoa em todos os módulos", () => {
  it("apaga identificação no contato, nas observações e nos e-mails enviados, e mantém a lista de descadastro", async () => {
    const lead = await inOrg("A", (tx) => createLead(tx, { organizationId: "A", userId: null }, { name: "Maria Silva", company: "Padaria", phone: "11988880001", email: "maria@padaria.com.br", originKey: "site" }));
    const contactId = (await prisma.contact.findFirstOrThrow({ where: { organizationId: "A", accountId: lead.accountId } })).id;
    await prisma.activity.create({ data: { organizationId: "A", type: "CALL", contactId, accountId: lead.accountId, notes: "Ela disse que o telefone pessoal é 11 98888-0001" } });
    const camp = await prisma.emailCampaign.create({ data: { organizationId: "A", name: "C", subject: "S", body: "x".repeat(30), audience: "todos", status: "SENT" } });
    await prisma.emailMessage.create({ data: { organizationId: "A", campaignId: camp.id, contactId, email: "maria@padaria.com.br", firstName: "Maria", status: "SENT" } });
    await prisma.emailSuppression.create({ data: { organizationId: "A", email: "maria@padaria.com.br", reason: "UNSUBSCRIBE" } });

    expect(await inOrg("A", (tx) => anonymizeContactData(tx, "A", contactId))).toBe(true);

    const c = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
    expect(c).toMatchObject({ name: "Pessoa removida (LGPD)", email: null, phone: null, phoneE164: null });
    expect(c.anonymizedAt).not.toBeNull();
    expect((await prisma.activity.findFirstOrThrow({ where: { contactId } })).notes).toBeNull();
    const msg = await prisma.emailMessage.findFirstOrThrow({ where: { campaignId: camp.id } });
    expect(msg.email).toBe(`removido-${contactId}@anonimizado.invalid`);
    expect(msg.firstName).toBeNull();
    expect(msg.status).toBe("SENT"); // os números da campanha continuam fechando
    expect(await prisma.emailSuppression.count({ where: { organizationId: "A", email: "maria@padaria.com.br" } })).toBe(1);
    // Repetir não quebra nem "re-anonimiza" com data nova.
    const first = c.anonymizedAt;
    await inOrg("A", (tx) => anonymizeContactData(tx, "A", contactId));
    expect((await prisma.contact.findUniqueOrThrow({ where: { id: contactId } })).anonymizedAt).toEqual(first);
  });

  it("não mexe em contato de outra organização", async () => {
    const lead = await inOrg("B", (tx) => createLead(tx, { organizationId: "B", userId: null }, { name: "João B", company: "Loja", phone: "11977770002", email: "joao@loja.com.br", originKey: "site" }));
    const contactId = (await prisma.contact.findFirstOrThrow({ where: { organizationId: "B", accountId: lead.accountId } })).id;
    expect(await inOrg("A", (tx) => anonymizeContactData(tx, "A", contactId))).toBe(false);
    expect((await prisma.contact.findUniqueOrThrow({ where: { id: contactId } })).email).toBe("joao@loja.com.br");
  });
});

describe("LGPD: entregar os dados de uma pessoa", () => {
  it("junta cadastro, base legal, atividades, origens e e-mails recebidos", async () => {
    const lead = await inOrg("B", (tx) => createLead(tx, { organizationId: "B", userId: null }, { name: "Ana B", company: "Oficina", phone: "11966660003", email: "ana@oficina.com.br", originKey: "site" }));
    const contactId = (await prisma.contact.findFirstOrThrow({ where: { organizationId: "B", accountId: lead.accountId } })).id;
    await prisma.contact.update({ where: { id: contactId }, data: { legalBasis: "CONSENT", legalBasisNote: "Formulário do site" } });
    const camp = await prisma.emailCampaign.create({ data: { organizationId: "B", name: "Novidades", subject: "Assunto X", body: "x".repeat(30), audience: "todos", status: "SENT" } });
    await prisma.emailMessage.create({ data: { organizationId: "B", campaignId: camp.id, contactId, email: "ana@oficina.com.br", status: "SENT", sentAt: new Date() } });
    const out = await inOrg("B", (tx) => contactDataExport(tx, "B", contactId));
    expect(out?.pessoa).toMatchObject({ nome: "Ana B", email: "ana@oficina.com.br", empresa: "Oficina" });
    expect(out?.baseLegal).toEqual({ tipo: "CONSENT", observacao: "Formulário do site" });
    expect(out?.emailsRecebidos).toEqual([expect.objectContaining({ campanha: "Novidades", assunto: "Assunto X", situacao: "SENT" })]);
    expect(out?.origens.length).toBeGreaterThan(0);
    expect(out?.pediuParaNaoReceberContato).toBe(false);
    // Outra organização não consegue pedir.
    expect(await inOrg("A", (tx) => contactDataExport(tx, "A", contactId))).toBeNull();
  });
});

describe("LGPD: retenção", () => {
  it("apaga visitas antigas, troca endereços antigos de destinatários e remove rascunhos descartados antigos; o recente fica", async () => {
    const now = new Date("2026-11-16T12:00:00Z");
    const old = (days: number) => new Date(now.getTime() - days * 86400000);
    const site = await prisma.site.create({ data: { organizationId: "A", name: "S", draft: {} } });
    await prisma.siteEvent.createMany({ data: [
      { organizationId: "A", siteId: site.id, type: "VIEW", visitorHash: "v", createdAt: old(RETENTION.siteEventDays + 5) },
      { organizationId: "A", siteId: site.id, type: "VIEW", visitorHash: "v", createdAt: old(10) },
    ] });
    const camp = await prisma.emailCampaign.create({ data: { organizationId: "A", name: "Antiga", subject: "S", body: "x".repeat(30), audience: "todos", status: "SENT" } });
    await prisma.emailMessage.create({ data: { organizationId: "A", campaignId: camp.id, email: "velho@x.com.br", firstName: "Velho", status: "SENT", createdAt: old(RETENTION.emailRecipientDays + 5) } });
    await prisma.emailMessage.create({ data: { organizationId: "A", campaignId: camp.id, email: "novo@x.com.br", firstName: "Novo", status: "SENT", createdAt: old(30) } });
    await prisma.contentDraft.create({ data: { organizationId: "A", generationId: "g1", kind: "ARTICLE", status: "DISCARDED", topic: "t", title: "velho", body: "b", updatedAt: old(RETENTION.discardedDraftDays + 5) } });
    await prisma.contentDraft.create({ data: { organizationId: "A", generationId: "g2", kind: "ARTICLE", status: "DISCARDED", topic: "t", title: "recente", body: "b", updatedAt: old(5) } });
    // updatedAt é preenchido pelo Prisma; força o valor antigo direto no banco.
    await db.exec(`UPDATE content_drafts SET "updatedAt" = '${old(RETENTION.discardedDraftDays + 5).toISOString()}' WHERE title = 'velho'`);

    const r = await inOrg("A", (tx) => runRetention(tx, "A", now));
    expect(r).toEqual({ siteEventsDeleted: 1, emailRecipientsScrubbed: 1, draftsDeleted: 1 });
    expect(await prisma.siteEvent.count({ where: { siteId: site.id } })).toBe(1);
    const msgs = await prisma.emailMessage.findMany({ where: { campaignId: camp.id }, orderBy: { createdAt: "asc" } });
    expect(msgs[0].email).toMatch(/^antigo-[0-9a-f]{16}-.+@anonimizado\.invalid$/);
    expect(msgs[0].firstName).toBeNull();
    expect(msgs[1].email).toBe("novo@x.com.br");
    expect((await prisma.contentDraft.findMany({ where: { organizationId: "A", status: "DISCARDED" } })).map((d) => d.title)).toEqual(["recente"]);
    // Segunda rodada não repete trabalho.
    expect(await inOrg("A", (tx) => runRetention(tx, "A", now))).toEqual({ siteEventsDeleted: 0, emailRecipientsScrubbed: 0, draftsDeleted: 0 });
  });
});
