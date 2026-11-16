import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";

const h = vi.hoisted(() => ({ prisma: null as unknown }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return h.prisma; } }));
vi.mock("@/lib/log-error", () => ({ logError: vi.fn() }));

import { createPrismaOnPglite } from "@/lib/db/pglite-harness";
import type { PrismaClient } from "@/generated/prisma/client";
import { getPack } from "@/packs/registry";
import { generateContent } from "./generate";
import { buildContentPrompt } from "./prompt";
import { buildSignature, runChecks } from "./checks";
import type { ModelCall } from "./schema";

let db: PGlite;
let prisma: PrismaClient;

const okText: ModelCall = async () => ({ ideas: null, usage: { input: 100, output: 200 }, text: { title: "Como abrir uma empresa", body: "Passo a passo para abrir a sua empresa.", sources: [{ label: "Receita", url: "https://www.gov.br/receitafederal" }, { label: "busca", url: "https://www.google.com/search?q=x" }], toVerify: ["Prazo vigente"] } });
const ideas: ModelCall = async () => ({ text: null, usage: { input: 50, output: 80 }, ideas: { ideas: Array.from({ length: 5 }, (_, i) => ({ title: `Ideia ${i + 1}`, hook: "Gancho", angle: "Ângulo", format: "POST" as const })) } });
const boom: ModelCall = async () => { throw new Error("credit balance too low (detalhe interno)"); };
const empty: ModelCall = async () => ({ ideas: null, text: null, usage: { input: 1, output: 1 } });

beforeAll(async () => {
  const r = await createPrismaOnPglite();
  db = r.db;
  prisma = r.prisma;
  h.prisma = prisma;
  await prisma.user.create({ data: { id: "u1", email: "u1@x.com", name: "Maria" } });
  const soon = new Date(Date.now() + 5 * 86400000);
  await prisma.organization.create({ data: { id: "T", name: "Escritório Teste", city: "Jundiaí", state: "SP", plan: "STARTER", trialEndsAt: soon, responsibleName: "Maria Souza", professionalRegistration: "CRC 1SP123456/O-0" } });
  await prisma.organization.create({ data: { id: "P", name: "Pago", plan: "STARTER", trialEndsAt: null } });
  await prisma.organization.create({ data: { id: "E", name: "Enterprise Pago", plan: "ENTERPRISE", trialEndsAt: null, creditBalance: 5 } });
  await prisma.organization.create({ data: { id: "N", name: "Sem Assinatura", plan: "STARTER", trialEndsAt: new Date(Date.now() + 86400000) } });
  await prisma.organizationPack.create({ data: { organizationId: "T", packKey: "contabilidade", packVersion: "1.0.0", snapshot: {} } });
  await prisma.organizationPack.create({ data: { organizationId: "N", packKey: "contabilidade", packVersion: "1.0.0", snapshot: {} } });
}, 60_000);
afterAll(async () => {
  await prisma.$disconnect();
  await db.close();
});

const drafts = (org: string) => prisma.$transaction(async (tx) => { await tx.$executeRawUnsafe("SET LOCAL ROLE spinos_app"); await tx.$executeRaw`SELECT set_config('app.current_org_id', ${org}, true)`; return tx.contentDraft.findMany({ where: { organizationId: org }, orderBy: { createdAt: "asc" } }); });

describe("regras do pacote aplicadas ao texto", () => {
  const pack = getPack("contabilidade")!;
  it("avisa de preço, promessa, comparação e superlativo, e deixa passar texto limpo", () => {
    expect(runChecks(pack, "Planos a partir de R$ 99")).toHaveLength(1);
    expect(runChecks(pack, "Somos o melhor escritório e garantimos economia")).toHaveLength(2);
    expect(runChecks(pack, "Diferente dos outros escritórios, atendemos rápido")).toHaveLength(1);
    expect(runChecks(pack, "Entenda as diferenças entre os regimes tributários e veja quando revisar a sua contabilidade.")).toEqual([]);
    expect(runChecks(null, "R$ 100")).toEqual([]);
  });
  it("assinatura usa os dados reais; sem eles fica em branco com aviso", () => {
    const full = buildSignature(pack, { name: "Escritório X", responsibleName: "Maria", professionalRegistration: "CRC 1" })!;
    expect(full.text).toBe("Escritório X. Maria, Contador(a), CRC 1.");
    expect(full.warning).toBeNull();
    const missing = buildSignature(pack, { name: "Escritório X", responsibleName: null, professionalRegistration: null })!;
    expect(missing.text).toContain("[responsável técnico e registro profissional]");
    expect(missing.warning).toContain("obrigatória");
    expect(buildSignature(getPack("geral")!, { name: "X", responsibleName: null, professionalRegistration: null })).toBeNull();
  });
  it("o prompt leva as regras do segmento e a regra de não inventar fato", () => {
    const p = buildContentPrompt({ name: "Escritório X", city: "Jundiaí", state: "SP", segment: null }, pack, { kind: "ARTICLE", topic: "Reforma tributária" });
    expect(p).toContain("Reforma tributária");
    expect(p).toContain("NBC PG 01");
    expect(p).toContain("Nunca invente fatos");
    expect(p).toContain("RASCUNHO");
  });
});

describe("gerar conteúdo", () => {
  it("texto: grava como rascunho, assina com o responsável, filtra fonte de busca e guarda avisos", async () => {
    const r = await generateContent("T", "u1", { kind: "ARTICLE", topic: "Como abrir uma empresa" }, okText);
    expect(r).toMatchObject({ status: "ok", count: 1 });
    const [d] = await drafts("T");
    expect(d).toMatchObject({ kind: "ARTICLE", status: "DRAFT", usedCredit: false, packKey: "contabilidade", createdByUserId: "u1" });
    expect(d.body).toContain("Maria Souza, Contador(a), CRC 1SP123456/O-0");
    expect(d.sources).toEqual([{ label: "Receita", url: "https://www.gov.br/receitafederal" }]);
    expect(d.toVerify).toEqual(["Prazo vigente"]);
    expect(d.warnings).toEqual([]);
  });

  it("sem responsável e registro, a assinatura fica em branco com aviso", async () => {
    await generateContent("N", "u1", { kind: "SOCIAL_POST", topic: "Calendário fiscal", channel: "INSTAGRAM" }, okText);
    const [d] = await drafts("N");
    expect(d.channel).toBe("INSTAGRAM");
    expect(d.body).toContain("[responsável técnico e registro profissional]");
    expect((d.warnings as string[]).join(" ")).toContain("Falta o responsável técnico");
  });

  it("ideias: 5 linhas, um único uso", async () => {
    const r = await generateContent("T", "u1", { kind: "IDEA", topic: "Imposto de Renda" }, ideas);
    expect(r).toMatchObject({ status: "ok", count: 5 });
    const rows = (await drafts("T")).filter((d) => d.kind === "IDEA");
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((d) => d.generationId)).size).toBe(1);
  });

  it("pedido inválido não gasta nada e não chama a IA", async () => {
    const spy = vi.fn(okText);
    expect(await generateContent("T", "u1", { kind: "ARTICLE", topic: "a" }, spy)).toMatchObject({ status: "invalid" });
    expect(await generateContent("T", "u1", { kind: "PODCAST", topic: "abc def" }, spy)).toMatchObject({ status: "invalid" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("trial: o teto é de 3 pedidos no total; passou, recusa sem crédito e usa crédito quando há", async () => {
    // T já fez 2 pedidos (artigo e ideias); o terceiro ainda cabe.
    expect(await generateContent("T", "u1", { kind: "EMAIL", topic: "Novidade fiscal do mês" }, okText)).toMatchObject({ status: "ok" });
    const spy = vi.fn(okText);
    expect(await generateContent("T", "u1", { kind: "EMAIL", topic: "Outro assunto" }, spy)).toEqual({ status: "limit", limit: 3, trialing: true });
    expect(spy).not.toHaveBeenCalled();
    await prisma.organization.update({ where: { id: "T" }, data: { creditBalance: 2 } });
    expect(await generateContent("T", "u1", { kind: "EMAIL", topic: "Outro assunto" }, okText)).toMatchObject({ status: "ok" });
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: "T" } })).creditBalance).toBe(1);
    expect((await drafts("T")).at(-1)?.usedCredit).toBe(true);
  });

  it("falha da IA devolve o crédito, não grava nada e não vaza o detalhe interno", async () => {
    const before = (await drafts("T")).length;
    const r = await generateContent("T", "u1", { kind: "ARTICLE", topic: "Assunto qualquer" }, boom);
    expect(r).toEqual({ status: "error", message: "Não foi possível gerar agora. Tente de novo em instantes." });
    expect(JSON.stringify(r)).not.toContain("credit balance");
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: "T" } })).creditBalance).toBe(1);
    expect((await drafts("T")).length).toBe(before);
  });

  it("resposta vazia da IA também devolve o crédito", async () => {
    const r = await generateContent("T", "u1", { kind: "ARTICLE", topic: "Assunto qualquer" }, empty);
    expect(r.status).toBe("error");
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: "T" } })).creditBalance).toBe(1);
  });

  it("conta paga: o teto é mensal do plano; Enterprise pago nunca usa crédito avulso", async () => {
    for (let i = 0; i < 10; i++) expect((await generateContent("P", "u1", { kind: "SOCIAL_POST", topic: `Assunto número ${i}` }, okText)).status).toBe("ok");
    expect(await generateContent("P", "u1", { kind: "SOCIAL_POST", topic: "Assunto onze" }, okText)).toEqual({ status: "limit", limit: 10, trialing: false });
    // Enterprise: simula o teto mensal já usado.
    await prisma.contentDraft.createMany({ data: Array.from({ length: 80 }, (_, i) => ({ organizationId: "E", generationId: `g${i}`, kind: "ARTICLE" as const, topic: "x", title: "x", body: "x" })) });
    expect(await generateContent("E", "u1", { kind: "ARTICLE", topic: "Assunto extra" }, okText)).toEqual({ status: "limit", limit: 80, trialing: false });
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: "E" } })).creditBalance).toBe(5);
  }, 30_000);

  it("uma organização não enxerga os rascunhos da outra (RLS)", async () => {
    expect((await drafts("P")).every((d) => d.organizationId === "P")).toBe(true);
    expect(await drafts("T")).not.toEqual(await drafts("P"));
  });
});

describe("pedidos simultâneos não furam teto nem deixam o saldo negativo", () => {
  it("5 pedidos ao mesmo tempo num teste de 3: exatamente 3 chamam a IA", async () => {
    await prisma.organization.create({ data: { id: "C1", name: "Corrida", plan: "STARTER", trialEndsAt: new Date(Date.now() + 86400000) } });
    const spy = vi.fn(okText);
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => generateContent("C1", "u1", { kind: "ARTICLE", topic: `Assunto simultâneo ${i}` }, spy)));
    expect(results.filter((r) => r.status === "ok")).toHaveLength(3);
    expect(results.filter((r) => r.status === "limit")).toHaveLength(2);
    expect(spy).toHaveBeenCalledTimes(3);
    expect((await drafts("C1")).filter((d) => d.body !== "")).toHaveLength(3);
  }, 30_000);

  it("com 1 crédito e 4 pedidos acima do teto: só um usa o crédito e o saldo nunca fica negativo", async () => {
    await prisma.organization.create({ data: { id: "C2", name: "Crédito", plan: "STARTER", trialEndsAt: new Date(Date.now() + 86400000), creditBalance: 1 } });
    for (let i = 0; i < 3; i++) await generateContent("C2", "u1", { kind: "ARTICLE", topic: `Assunto do teste ${i}` }, okText);
    const results = await Promise.all(Array.from({ length: 4 }, (_, i) => generateContent("C2", "u1", { kind: "ARTICLE", topic: `Assunto acima do teto ${i}` }, okText)));
    expect(results.filter((r) => r.status === "ok")).toHaveLength(1);
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: "C2" } })).creditBalance).toBe(0);
  }, 30_000);

  it("a reserva não aparece como rascunho e some quando a IA falha", async () => {
    await prisma.organization.create({ data: { id: "C3", name: "Falha", plan: "STARTER", trialEndsAt: new Date(Date.now() + 86400000) } });
    await generateContent("C3", "u1", { kind: "ARTICLE", topic: "Vai falhar aqui" }, boom);
    expect(await prisma.contentDraft.count({ where: { organizationId: "C3" } })).toBe(0);
    // O uso foi liberado: ainda cabem os 3 pedidos do teste.
    for (let i = 0; i < 3; i++) expect((await generateContent("C3", "u1", { kind: "ARTICLE", topic: `Assunto ${i} depois` }, okText)).status).toBe("ok");
  }, 30_000);
});
