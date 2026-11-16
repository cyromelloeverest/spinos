import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";

const h = vi.hoisted(() => {
  process.env.LIFECYCLE_EMAIL_SECRET = "segredo-de-teste";
  return { prisma: null as unknown };
});
vi.mock("@/lib/prisma", () => ({ get prisma() { return h.prisma; } }));
vi.mock("@/lib/log-error", () => ({ logError: vi.fn() }));

import { createPrismaOnPglite } from "@/lib/db/pglite-harness";
import type { PrismaClient } from "@/generated/prisma/client";
import { createLead } from "@/lib/crm/leads";
import { moveToKind } from "@/lib/crm/opportunities";
import { resolveAudience, suppressEmail } from "./audience";
import { CampaignError, cancelCampaign, previewCampaign, processOrganizationQueue, saveCampaign, startCampaign } from "./campaign";
import { fillName, renderCampaignHtml, renderCampaignText } from "./render";
import { unsubscribeUrl, verifyUnsubscribe } from "./tokens";
import { safeDisplayName, type EmailProvider, type OutgoingEmail } from "./provider";

let db: PGlite;
let prisma: PrismaClient;

async function inOrg<T>(orgId: string, fn: (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL ROLE spinos_app");
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, true)`;
    return fn(tx);
  }, { timeout: 30000 });
}

let n = 0;
async function contact(org: string, o: { basis?: "CONSENT" | "CONTRACT" | "LEGITIMATE_INTEREST" | null; email?: string | null; outcome?: "WON" | "LOST"; name?: string } = {}) {
  n += 1;
  const email = o.email === undefined ? `pessoa${n}@exemplo.com.br` : o.email;
  return inOrg(org, async (tx) => {
    const lead = await createLead(tx, { organizationId: org, userId: null }, { name: o.name ?? `Pessoa Numero${n}`, company: `Empresa ${n}`, phone: `1198800${String(1000 + n)}`, email, originKey: "site" });
    await tx.contact.updateMany({ where: { organizationId: org, accountId: lead.accountId }, data: { legalBasis: o.basis === undefined ? "CONSENT" : o.basis } });
    if (o.outcome) await moveToKind(tx, { organizationId: org, userId: null }, lead.opportunityId, o.outcome);
    return lead;
  });
}

const okProvider = () => {
  const sent: OutgoingEmail[] = [];
  const provider: EmailProvider = { send: async (e) => { sent.push(e); return { id: `msg_${sent.length}` }; } };
  return { sent, provider };
};

const draft = { name: "Novidade do mês", subject: "Novidades fiscais", preheader: "O que muda", body: "Olá, {{nome}}!\n\nSegue uma novidade para a sua empresa neste mês.", audience: "todos" };

beforeAll(async () => {
  const r = await createPrismaOnPglite();
  db = r.db;
  prisma = r.prisma;
  h.prisma = prisma;
  await prisma.user.create({ data: { id: "u1", email: "dono@escritorio.com.br", name: "Dono" } });
  await prisma.organization.create({ data: { id: "A", name: 'Escritório "Teste" <A>', city: "Jundiaí", state: "SP", cnpj: "12.345.678/0001-90", plan: "PROFISSIONAL", trialEndsAt: null } });
  await prisma.organization.create({ data: { id: "TR", name: "Em Teste", plan: "STARTER", trialEndsAt: new Date(Date.now() + 86400000) } });
  await prisma.organization.create({ data: { id: "B", name: "Outra", plan: "PROFISSIONAL", trialEndsAt: null } });
  await prisma.membership.create({ data: { userId: "u1", organizationId: "A", role: "OWNER" } });
}, 60_000);
afterAll(async () => {
  await prisma.$disconnect();
  await db.close();
});

describe("descadastro e renderização", () => {
  it("o link carrega organização e e-mail assinados; adulterar invalida", () => {
    const url = new URL(unsubscribeUrl("A", "Maria@Exemplo.com"));
    const [o, e, t] = ["o", "e", "t"].map((k) => url.searchParams.get(k));
    expect(verifyUnsubscribe(o, e, t)).toBe("maria@exemplo.com");
    expect(verifyUnsubscribe("B", e, t)).toBeNull();
    expect(verifyUnsubscribe(o, Buffer.from("outra@pessoa.com").toString("base64url"), t)).toBeNull();
    expect(verifyUnsubscribe(o, e, "x" + t)).toBeNull();
    expect(verifyUnsubscribe(null, e, t)).toBeNull();
    expect(verifyUnsubscribe(o, "###", t)).toBeNull();
  });

  it("nome entra no texto; sem nome a saudação não fica quebrada", () => {
    expect(fillName("Olá, {{nome}}! Tudo bem?", "Maria Souza")).toBe("Olá, Maria! Tudo bem?");
    expect(fillName("Olá, {{nome}}! Tudo bem?", null)).toBe("Olá! Tudo bem?");
    expect(fillName("Oi {{ nome }}, segue o aviso.", "João")).toBe("Oi João, segue o aviso.");
  });

  it("HTML do autor é escapado; rodapé identifica o remetente e traz o descadastro", () => {
    const base = { subject: "A <b>", body: "Texto <script>alert(1)</script>\nlinha dois\n\nSegundo parágrafo", firstName: "Ana", senderName: "Escritório X", senderLines: ["Escritório X", "CNPJ 1 · Jundiaí/SP"], unsubscribeUrl: "https://app.spinos.com.br/descadastrar?x=1" };
    const html = renderCampaignHtml(base);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("linha dois");
    expect(html).toContain("CNPJ 1 · Jundiaí/SP");
    expect(html).toContain('href="https://app.spinos.com.br/descadastrar?x=1"');
    expect(renderCampaignText(base)).toContain("Para não receber mais: https://app.spinos.com.br/descadastrar?x=1");
    expect(safeDisplayName('Escritório "Teste" <A>\nB')).toBe("Escritório Teste A B");
  });
});

describe("quem pode receber", () => {
  it("só consentimento ou contrato, com e-mail válido, sem descadastro e sem repetir pessoa", async () => {
    await contact("A", { basis: "CONSENT" });
    await contact("A", { basis: "CONTRACT", outcome: "WON" });
    await contact("A", { basis: "LEGITIMATE_INTEREST" });
    await contact("A", { basis: null });
    await contact("A", { basis: "CONSENT", email: null });
    await contact("A", { basis: "CONSENT", email: "repetido@exemplo.com.br" });
    const dup = await contact("A", { basis: "CONSENT", email: "outro-endereco@exemplo.com.br" });
    await prisma.contact.updateMany({ where: { organizationId: "A", accountId: dup.accountId }, data: { email: "REPETIDO@exemplo.com.br" } });
    await contact("A", { basis: "CONSENT", email: "saiu@exemplo.com.br" });
    await inOrg("A", (tx) => suppressEmail(tx, "A", "saiu@exemplo.com.br", "UNSUBSCRIBE"));

    const all = await inOrg("A", (tx) => resolveAudience(tx, "A", "todos"));
    expect(all.recipients.map((r) => r.email).sort()).toEqual(expect.arrayContaining(["repetido@exemplo.com.br"]));
    expect(all.recipients).toHaveLength(3);
    expect(all.excluded.semBaseLegal).toBe(2);
    expect(all.excluded.semEmail).toBe(1);
    const clientes = await inOrg("A", (tx) => resolveAudience(tx, "A", "clientes"));
    expect(clientes.recipients).toHaveLength(1);
    const andamento = await inOrg("A", (tx) => resolveAudience(tx, "A", "em_andamento"));
    expect(andamento.recipients.length).toBe(2);
  });

  it("descadastrar marca o contato e tira da fila o que ainda não saiu", async () => {
    const c = await prisma.contact.findFirst({ where: { organizationId: "A", email: "saiu@exemplo.com.br" } });
    expect(c?.optedOutAt).not.toBeNull();
    expect(await prisma.emailSuppression.count({ where: { organizationId: "A", email: "saiu@exemplo.com.br", reason: "UNSUBSCRIBE" } })).toBe(1);
  });

  it("nada vaza entre organizações", async () => {
    await contact("B", { basis: "CONSENT", email: "so-da-b@exemplo.com.br" });
    const a = await inOrg("A", (tx) => resolveAudience(tx, "A", "todos"));
    expect(a.recipients.map((r) => r.email)).not.toContain("so-da-b@exemplo.com.br");
  });
});

describe("liberar e enviar a campanha", () => {
  it("rascunho valida os campos e só é editável enquanto rascunho", async () => {
    await inOrg("A", async (tx) => {
      await expect(saveCampaign(tx, "A", "u1", null, { ...draft, subject: "" })).rejects.toBeInstanceOf(CampaignError);
      await expect(saveCampaign(tx, "A", "u1", null, { ...draft, body: "curto" })).rejects.toThrow("curto");
      await expect(saveCampaign(tx, "A", "u1", null, { ...draft, audience: "geral" })).rejects.toThrow("para quem");
    });
  });

  it("teste gratuito não envia campanha para contatos reais", async () => {
    const c = await inOrg("TR", (tx) => saveCampaign(tx, "TR", "u1", null, draft));
    await expect(inOrg("TR", (tx) => startCampaign(tx, { organizationId: "TR", userId: "u1" }, c.id))).rejects.toThrow("depois da assinatura");
  });

  it("pré-visualização mostra quantos recebem e avisos do segmento", async () => {
    const c = await inOrg("A", (tx) => saveCampaign(tx, "A", "u1", null, draft));
    const p = await inOrg("A", (tx) => previewCampaign(tx, "A", c.id));
    expect(p.recipients).toBe(3);
    expect(p.excluded.descadastrados).toBe(1);
    expect(Array.isArray(p.warnings)).toBe(true);
  });

  it("libera, enfileira um por destinatário, congela o HTML e envia com cabeçalhos de descadastro", async () => {
    const c = await inOrg("A", (tx) => saveCampaign(tx, "A", "u1", null, draft));
    const started = await inOrg("A", (tx) => startCampaign(tx, { organizationId: "A", userId: "u1" }, c.id));
    expect(started.recipients).toBe(3);
    const row = await prisma.emailCampaign.findUniqueOrThrow({ where: { id: c.id } });
    expect(row).toMatchObject({ status: "SENDING", totalRecipients: 3, startedByUserId: "u1" });
    expect(row.htmlSnapshot).toContain("CNPJ 12.345.678/0001-90");
    // Já liberada, não pode ser editada nem liberada de novo.
    await expect(inOrg("A", (tx) => saveCampaign(tx, "A", "u1", c.id, draft))).rejects.toThrow("já foi enviada");
    await expect(inOrg("A", (tx) => startCampaign(tx, { organizationId: "A", userId: "u1" }, c.id))).rejects.toThrow("já foi enviada");

    const { sent, provider } = okProvider();
    const r = await inOrg("A", (tx) => processOrganizationQueue(tx, "A", provider));
    expect(r).toEqual({ sent: 3, failed: 0, paused: false });
    expect(sent).toHaveLength(3);
    expect(sent[0].from).toBe("Escritório Teste A <envio@spinos.com.br>");
    expect(sent[0].replyTo).toBe("dono@escritorio.com.br");
    expect(sent[0].headers?.["List-Unsubscribe"]).toMatch(/^<https?:\/\/.*\/api\/email\/unsubscribe\?o=A&e=.*&t=.*>$/);
    expect(sent[0].headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(sent[0].html).toContain("Olá, Pessoa!");
    expect((await prisma.emailCampaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("SENT");
    // Rodar de novo não reenvia nada.
    const again = await inOrg("A", (tx) => processOrganizationQueue(tx, "A", provider));
    expect(again.sent).toBe(0);
    expect(sent).toHaveLength(3);
  });

  it("falha do provedor marca só aquela mensagem; descadastro no meio do caminho é respeitado", async () => {
    await contact("A", { basis: "CONSENT", email: "novo1@exemplo.com.br" });
    await contact("A", { basis: "CONSENT", email: "novo2@exemplo.com.br" });
    // As 4 pessoas anteriores já receberam outra campanha; esta é uma nova, para as mesmas + 2.
    const c = await inOrg("A", (tx) => saveCampaign(tx, "A", "u1", null, { ...draft, name: "Segunda" }));
    await inOrg("A", (tx) => startCampaign(tx, { organizationId: "A", userId: "u1" }, c.id));
    await inOrg("A", (tx) => suppressEmail(tx, "A", "novo2@exemplo.com.br", "UNSUBSCRIBE"));
    const sent: string[] = [];
    const flaky: EmailProvider = { send: async (e) => { if (e.to === "novo1@exemplo.com.br") throw new Error("Resend 422"); sent.push(e.to); return { id: "x" }; } };
    const r = await inOrg("A", (tx) => processOrganizationQueue(tx, "A", flaky));
    expect(r.failed).toBe(1); // novo1 falhou no provedor; novo2 já saiu da fila ao se descadastrar
    expect(sent).not.toContain("novo2@exemplo.com.br");
    const failed = await prisma.emailMessage.findMany({ where: { campaignId: c.id, status: "FAILED" } });
    expect(failed.map((m) => m.email).sort()).toEqual(["novo1@exemplo.com.br", "novo2@exemplo.com.br"]);
    expect((await prisma.emailCampaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("SENT");
  });

  it("lotes: com mais destinatários que o lote, cada rodada envia só um pedaço e a campanha segue enviando", async () => {
    await prisma.organization.create({ data: { id: "L", name: "Lote", plan: "ENTERPRISE", trialEndsAt: null } });
    for (let i = 0; i < 45; i++) await contact("L", { basis: "CONSENT", email: `lote${i}@exemplo.com.br` });
    const c = await inOrg("L", (tx) => saveCampaign(tx, "L", "u1", null, draft));
    await inOrg("L", (tx) => startCampaign(tx, { organizationId: "L", userId: "u1" }, c.id));
    const { provider } = okProvider();
    const first = await inOrg("L", (tx) => processOrganizationQueue(tx, "L", provider));
    expect(first.sent).toBe(40);
    expect((await prisma.emailCampaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("SENDING");
    const second = await inOrg("L", (tx) => processOrganizationQueue(tx, "L", provider));
    expect(second.sent).toBe(5);
    expect((await prisma.emailCampaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("SENT");
  }, 60_000);

  it("teto do mês do plano é respeitado", async () => {
    await prisma.organization.create({ data: { id: "S", name: "Starter", plan: "STARTER", trialEndsAt: null } });
    await contact("S", { basis: "CONSENT", email: "s1@exemplo.com.br" });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org_id', 'S', true)`;
      const camp = await tx.emailCampaign.create({ data: { organizationId: "S", name: "x", subject: "x", body: "x".repeat(30), audience: "todos", status: "SENT" } });
      await tx.emailMessage.createMany({ data: Array.from({ length: 500 }, (_, i) => ({ organizationId: "S", campaignId: camp.id, email: `f${i}@x.com`, status: "SENT" as const })) });
    });
    const c = await inOrg("S", (tx) => saveCampaign(tx, "S", "u1", null, draft));
    await expect(inOrg("S", (tx) => startCampaign(tx, { organizationId: "S", userId: "u1" }, c.id))).rejects.toThrow("500 e-mails por mês");
  }, 30_000);

  it("interruptor geral pausa liberação e envio; cancelar tira o que falta da fila", async () => {
    const c = await inOrg("A", (tx) => saveCampaign(tx, "A", "u1", null, { ...draft, name: "Terceira" }));
    process.env.EMAIL_SENDING_DISABLED = "1";
    await expect(inOrg("A", (tx) => startCampaign(tx, { organizationId: "A", userId: "u1" }, c.id))).rejects.toThrow("pausado");
    delete process.env.EMAIL_SENDING_DISABLED;
    await inOrg("A", (tx) => startCampaign(tx, { organizationId: "A", userId: "u1" }, c.id));
    process.env.EMAIL_SENDING_DISABLED = "1";
    const { provider, sent } = okProvider();
    expect(await inOrg("A", (tx) => processOrganizationQueue(tx, "A", provider))).toMatchObject({ paused: true, sent: 0 });
    delete process.env.EMAIL_SENDING_DISABLED;
    await inOrg("A", (tx) => cancelCampaign(tx, "A", c.id));
    expect(sent).toHaveLength(0);
    expect((await prisma.emailCampaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("CANCELED");
    expect(await prisma.emailMessage.count({ where: { campaignId: c.id, status: "QUEUED" } })).toBe(0);
    await expect(inOrg("A", (tx) => cancelCampaign(tx, "A", c.id))).rejects.toThrow("sendo enviada");
  });
});
