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
import { CampaignError, cancelCampaign, dailyEmailCap, deliverabilityStatus, previewCampaign, processOrganizationQueue, saveCampaign, startCampaign } from "./campaign";
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
    const r = await processOrganizationQueue("A", provider, (fn) => inOrg("A", fn));
    expect(r).toEqual({ sent: 3, failed: 0, paused: false });
    expect(sent).toHaveLength(3);
    expect(sent[0].from).toBe("Escritório Teste A <envio@spinos.com.br>");
    expect(sent[0].replyTo).toBe("dono@escritorio.com.br");
    expect(sent[0].headers?.["List-Unsubscribe"]).toMatch(/^<https?:\/\/.*\/api\/email\/unsubscribe\?o=A&e=.*&t=.*>$/);
    expect(sent[0].headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(sent[0].html).toContain("Olá, Pessoa!");
    expect((await prisma.emailCampaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("SENT");
    // Rodar de novo não reenvia nada.
    const again = await processOrganizationQueue("A", provider, (fn) => inOrg("A", fn));
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
    const r = await processOrganizationQueue("A", flaky, (fn) => inOrg("A", fn));
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
    const first = await processOrganizationQueue("L", provider, (fn) => inOrg("L", fn));
    expect(first.sent).toBe(40);
    expect((await prisma.emailCampaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("SENDING");
    const second = await processOrganizationQueue("L", provider, (fn) => inOrg("L", fn));
    expect(second.sent).toBe(5);
    expect((await prisma.emailCampaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("SENT");
  }, 60_000);

  it("teto do dia: nos primeiros 30 dias saem 100 por dia e o resto continua na fila para o dia seguinte", async () => {
    await prisma.organization.create({ data: { id: "D", name: "Dia", plan: "ENTERPRISE", trialEndsAt: null } });
    for (let i = 0; i < 105; i++) await contact("D", { basis: "CONSENT", email: `dia${i}@exemplo.com.br` });
    const c = await inOrg("D", (tx) => saveCampaign(tx, "D", "u1", null, draft));
    await inOrg("D", (tx) => startCampaign(tx, { organizationId: "D", userId: "u1" }, c.id));
    const { provider } = okProvider();
    const t0 = new Date();
    let total = 0;
    for (let i = 0; i < 5; i++) total += (await processOrganizationQueue("D", provider, (fn) => inOrg("D", fn), t0)).sent;
    expect(total).toBe(100);
    expect((await prisma.emailCampaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("SENDING");
    const next = await processOrganizationQueue("D", provider, (fn) => inOrg("D", fn), new Date(t0.getTime() + 26 * 3600_000));
    expect(next.sent).toBe(5);
    expect((await prisma.emailCampaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("SENT");
  }, 120_000);

  it("teto diário por plano e aquecimento de 30 dias", () => {
    const day = 86400000;
    const now = new Date("2026-12-31T12:00:00Z");
    expect(dailyEmailCap("STARTER", null, now)).toBe(100);
    expect(dailyEmailCap("ENTERPRISE", null, now)).toBe(100);
    expect(dailyEmailCap("ENTERPRISE", new Date(now.getTime() - 10 * day), now)).toBe(100);
    expect(dailyEmailCap("PROFISSIONAL", new Date(now.getTime() - 31 * day), now)).toBe(300);
    expect(dailyEmailCap("ENTERPRISE", new Date(now.getTime() - 31 * day), now)).toBe(800);
    expect(dailyEmailCap("STARTER", new Date(now.getTime() - 31 * day), now)).toBe(100);
  });

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
    expect(await processOrganizationQueue("A", provider, (fn) => inOrg("A", fn))).toMatchObject({ paused: true, sent: 0 });
    delete process.env.EMAIL_SENDING_DISABLED;
    await inOrg("A", (tx) => cancelCampaign(tx, "A", c.id));
    expect(sent).toHaveLength(0);
    expect((await prisma.emailCampaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("CANCELED");
    expect(await prisma.emailMessage.count({ where: { campaignId: c.id, status: "QUEUED" } })).toBe(0);
    await expect(inOrg("A", (tx) => cancelCampaign(tx, "A", c.id))).rejects.toThrow("sendo enviada");
  });
});

describe("freio de reputação", () => {
  it("muitos endereços inexistentes pausam o envio e a liberação de novas campanhas", async () => {
    await prisma.organization.create({ data: { id: "R", name: "Reputação", plan: "ENTERPRISE", trialEndsAt: null } });
    await contact("R", { basis: "CONSENT", email: "ok@exemplo.com.br" });
    const camp = await prisma.emailCampaign.create({ data: { organizationId: "R", name: "x", subject: "x", body: "x".repeat(30), audience: "todos", status: "SENT" } });
    const mk = (status: "SENT" | "BOUNCED" | "COMPLAINED", i: number) => ({ organizationId: "R", campaignId: camp.id, email: `h${status}${i}@x.com`, status, sentAt: new Date() });
    await prisma.emailMessage.createMany({ data: [...Array.from({ length: 50 }, (_, i) => mk("SENT", i)), ...Array.from({ length: 4 }, (_, i) => mk("BOUNCED", i))] });
    expect((await inOrg("R", (tx) => deliverabilityStatus(tx, "R"))).paused).toBe(false); // 4 de 54 (7%) mas menos de 5 devolvidos
    await prisma.emailMessage.create({ data: mk("BOUNCED", 99) });
    const status = await inOrg("R", (tx) => deliverabilityStatus(tx, "R"));
    expect(status).toEqual({ paused: true, reason: "muitos endereços que não existem" });
    const c = await inOrg("R", (tx) => saveCampaign(tx, "R", "u1", null, draft));
    await expect(inOrg("R", (tx) => startCampaign(tx, { organizationId: "R", userId: "u1" }, c.id))).rejects.toThrow("pausado");
    const { provider, sent } = okProvider();
    expect(await processOrganizationQueue("R", provider, (fn) => inOrg("R", fn))).toMatchObject({ paused: true, sent: 0 });
    expect(sent).toHaveLength(0);
  }, 30_000);

  it("reclamações de spam acima de 0,3% pausam mesmo com poucos envios", async () => {
    await prisma.organization.create({ data: { id: "R2", name: "Reclamações", plan: "ENTERPRISE", trialEndsAt: null } });
    const camp = await prisma.emailCampaign.create({ data: { organizationId: "R2", name: "x", subject: "x", body: "x".repeat(30), audience: "todos", status: "SENT" } });
    await prisma.emailMessage.createMany({ data: [...Array.from({ length: 200 }, (_, i) => ({ organizationId: "R2", campaignId: camp.id, email: `s${i}@x.com`, status: "SENT" as const, sentAt: new Date() })), ...Array.from({ length: 3 }, (_, i) => ({ organizationId: "R2", campaignId: camp.id, email: `c${i}@x.com`, status: "COMPLAINED" as const, sentAt: new Date() }))] });
    expect(await inOrg("R2", (tx) => deliverabilityStatus(tx, "R2"))).toEqual({ paused: true, reason: "reclamações de spam acima do tolerado" });
  });

  it("mensagens antigas (mais de 30 dias) não contam", async () => {
    await prisma.organization.create({ data: { id: "R3", name: "Antigo", plan: "ENTERPRISE", trialEndsAt: null } });
    const camp = await prisma.emailCampaign.create({ data: { organizationId: "R3", name: "x", subject: "x", body: "x".repeat(30), audience: "todos", status: "SENT" } });
    const old = new Date(Date.now() - 40 * 86400000);
    await prisma.emailMessage.createMany({ data: Array.from({ length: 10 }, (_, i) => ({ organizationId: "R3", campaignId: camp.id, email: `o${i}@x.com`, status: "COMPLAINED" as const, sentAt: old })) });
    expect((await inOrg("R3", (tx) => deliverabilityStatus(tx, "R3"))).paused).toBe(false);
  });
});

describe("fila: sem transação durante o envio", () => {
  it("rodadas simultâneas nunca mandam a mesma mensagem duas vezes, e cada envio leva chave de idempotência", async () => {
    await prisma.organization.create({ data: { id: "Q", name: "Fila", plan: "ENTERPRISE", trialEndsAt: null } });
    for (let i = 0; i < 6; i++) await contact("Q", { basis: "CONSENT", email: `q${i}@exemplo.com.br` });
    const c = await inOrg("Q", (tx) => saveCampaign(tx, "Q", "u1", null, draft));
    await inOrg("Q", (tx) => startCampaign(tx, { organizationId: "Q", userId: "u1" }, c.id));
    const { provider, sent } = okProvider();
    await Promise.all([processOrganizationQueue("Q", provider, (fn) => inOrg("Q", fn)), processOrganizationQueue("Q", provider, (fn) => inOrg("Q", fn))]);
    expect(sent.map((e) => e.to).sort()).toEqual(Array.from({ length: 6 }, (_, i) => `q${i}@exemplo.com.br`));
    expect(new Set(sent.map((e) => e.idempotencyKey)).size).toBe(6);
    expect(sent.every((e) => Boolean(e.idempotencyKey))).toBe(true);
    expect((await prisma.emailCampaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("SENT");
  }, 30_000);

  it("se o registro do resultado falha (transação estourou), a mensagem não é reenviada logo em seguida; passado o prazo volta para a fila com a mesma chave", async () => {
    await prisma.organization.create({ data: { id: "Q2", name: "Fila 2", plan: "ENTERPRISE", trialEndsAt: null } });
    await contact("Q2", { basis: "CONSENT", email: "unico@exemplo.com.br" });
    const c = await inOrg("Q2", (tx) => saveCampaign(tx, "Q2", "u1", null, draft));
    await inOrg("Q2", (tx) => startCampaign(tx, { organizationId: "Q2", userId: "u1" }, c.id));
    const { provider, sent } = okProvider();
    // Primeira rodada: o envio acontece, mas a gravação do resultado "estoura".
    let calls = 0;
    const flakyRun = (async (fn: (tx: never) => Promise<unknown>) => {
      calls += 1;
      // chamadas: 1 reserva, 2 supressão, 3 registro do resultado (falha), 4+ fechamento
      if (calls === 3) throw new Error("Transaction expired");
      return inOrg("Q2", fn as never);
    }) as never;
    const t0 = new Date();
    await processOrganizationQueue("Q2", provider, flakyRun, t0).catch(() => {});
    expect(sent).toHaveLength(1);
    expect((await prisma.emailMessage.findFirstOrThrow({ where: { campaignId: c.id } })).status).toBe("SENDING");
    // Logo depois: continua reservada, ninguém reenvia.
    await processOrganizationQueue("Q2", provider, (fn) => inOrg("Q2", fn), new Date(t0.getTime() + 60_000));
    expect(sent).toHaveLength(1);
    // Passado o prazo da reserva: volta à fila e sai de novo com a MESMA chave (o provedor descarta a repetição).
    await processOrganizationQueue("Q2", provider, (fn) => inOrg("Q2", fn), new Date(t0.getTime() + 11 * 60_000));
    expect(sent).toHaveLength(2);
    expect(sent[1].idempotencyKey).toBe(sent[0].idempotencyKey);
    expect((await prisma.emailCampaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("SENT");
  }, 30_000);
});
