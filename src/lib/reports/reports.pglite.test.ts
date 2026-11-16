import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";

const h = vi.hoisted(() => ({ prisma: null as unknown }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return h.prisma; } }));
vi.mock("@/lib/log-error", () => ({ logError: vi.fn() }));

import { createPrismaOnPglite } from "@/lib/db/pglite-harness";
import type { PrismaClient } from "@/generated/prisma/client";
import { createLead } from "@/lib/crm/leads";
import { moveToKind } from "@/lib/crm/opportunities";
import { marketingReport, parsePeriodKey, resolvePeriod, siteTraffic } from "./marketing";
import { addSpend, deleteSpend, importSpendCsv, parseSpendDate, SpendError } from "./spend";

let db: PGlite;
let prisma: PrismaClient;

async function inOrg<T>(orgId: string, fn: (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL ROLE spinos_app");
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, true)`;
    return fn(tx);
  });
}

const period = () => resolvePeriod("30d");
let n = 0;
async function lead(org: string, originKey: string, outcome?: "WON" | "LOST", value?: number) {
  n += 1;
  return inOrg(org, async (tx) => {
    const l = await createLead(tx, { organizationId: org, userId: null }, { name: `Pessoa ${n}`, company: `Empresa ${n}`, phone: `1199900${String(1000 + n)}`, originKey });
    if (outcome) {
      await moveToKind(tx, { organizationId: org, userId: null }, l.opportunityId, outcome);
      if (value != null) await tx.opportunity.update({ where: { id: l.opportunityId }, data: { wonValueBRL: value } });
    }
    return l;
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

describe("período", () => {
  it("chave inválida cai em 30 dias e a janela termina amanhã 00h de Brasília", () => {
    expect(parsePeriodKey("xyz")).toBe("30d");
    expect(parsePeriodKey("ano")).toBe("ano");
    const now = new Date("2026-11-16T15:00:00Z");
    const p = resolvePeriod("30d", now);
    expect(p.to.toISOString()).toBe("2026-11-17T03:00:00.000Z");
    expect(p.from.toISOString()).toBe("2026-10-18T03:00:00.000Z");
    expect(resolvePeriod("mes", now).from.toISOString()).toBe("2026-11-01T03:00:00.000Z");
    expect(resolvePeriod("ano", now).from.toISOString()).toBe("2026-01-01T03:00:00.000Z");
  });
});

describe("investimento", () => {
  it("lança com valor em formato brasileiro e recusa dados inválidos", async () => {
    const c = await inOrg("A", (tx) => addSpend(tx, "A", { name: "Google Ads", channel: "google_ads", amount: "1.500,50", date: "10/11/2026" }));
    expect(c.spendBRL).toBe(1500.5);
    expect(c.kind).toBe("AD");
    await inOrg("A", async (tx) => {
      await expect(addSpend(tx, "A", { name: "", channel: "google_ads", amount: "10", date: "" })).rejects.toBeInstanceOf(SpendError);
      await expect(addSpend(tx, "A", { name: "x", channel: "tiktok", amount: "10", date: "" })).rejects.toThrow("canal");
      await expect(addSpend(tx, "A", { name: "x", channel: "google_ads", amount: "0", date: "" })).rejects.toThrow("maior que zero");
      await expect(addSpend(tx, "A", { name: "x", channel: "google_ads", amount: "10", date: "31/02/2026" })).rejects.toThrow("Data inválida");
    });
    await inOrg("A", (tx) => deleteSpend(tx, "A", c.id));
    expect(await prisma.campaign.count({ where: { organizationId: "A" } })).toBe(0);
  });

  it("importa CSV com ; ou , e relata as linhas com problema sem derrubar as boas", async () => {
    const csv = ["data;canal;valor;descrição", "01/11/2026;google_ads;1000,00;Pesquisa", "2026-11-02,Meta Ads,\"500\",Remarketing", "xx/11/2026;google_ads;10", "03/11/2026;orkut;10"].join("\n");
    const r = await inOrg("A", (tx) => importSpendCsv(tx, "A", csv));
    expect(r.imported).toBe(2);
    expect(r.problems).toHaveLength(2);
    expect(r.problems[0]).toContain("Linha 4");
    const rows = await prisma.campaign.findMany({ where: { organizationId: "A" }, orderBy: { name: "asc" } });
    expect(rows.map((c) => `${c.channel}:${c.spendBRL}`).sort()).toEqual(["google_ads:1000", "meta_ads:500"]);
    await prisma.campaign.deleteMany({ where: { organizationId: "A" } });
  });

  it("parseSpendDate", () => {
    expect(parseSpendDate("16/11/2026")?.toISOString()).toBe("2026-11-16T15:00:00.000Z");
    expect(parseSpendDate("2026-11-16")?.toISOString()).toBe("2026-11-16T15:00:00.000Z");
    expect(parseSpendDate("16-11-2026")).toBeUndefined();
  });
});

describe("relatório de marketing: da origem ao contrato", () => {
  it("conta leads, ganhos, valor, custo por lead e por cliente por canal", async () => {
    // Site: 4 leads, 1 ganho (R$ 3.000), 1 perdido. Indicação: 1 lead ganho (R$ 1.000). Google Ads: 2 leads, nenhum ganho.
    await lead("A", "site", "WON", 3000);
    await lead("A", "site", "LOST");
    await lead("A", "site");
    await lead("A", "site");
    await lead("A", "indicacao", "WON", 1000);
    await lead("A", "google_ads");
    await lead("A", "google_ads");
    // Outra organização não pode aparecer.
    await lead("B", "site", "WON", 99999);
    await inOrg("A", (tx) => addSpend(tx, "A", { name: "Google Ads", channel: "google_ads", amount: "600", date: "" }));
    await inOrg("A", (tx) => addSpend(tx, "A", { name: "Panfleto", channel: "site", amount: "400", date: "" }));

    const r = await inOrg("A", (tx) => marketingReport(tx, "A", period()));
    expect(r.totals).toMatchObject({ leads: 7, won: 2, lost: 1, open: 4, wonValueBRL: 4000, spendBRL: 1000 });
    expect(r.totals.conversion).toBeCloseTo(2 / 7);
    expect(r.totals.cacBRL).toBe(500);

    const site = r.channels.find((c) => c.channel === "site")!;
    expect(site).toMatchObject({ leads: 4, won: 1, lost: 1, open: 2, wonValueBRL: 3000, avgTicketBRL: 3000, spendBRL: 400, costPerLeadBRL: 100, cacBRL: 400 });
    const ads = r.channels.find((c) => c.channel === "google_ads")!;
    expect(ads).toMatchObject({ leads: 2, won: 0, spendBRL: 600, costPerLeadBRL: 300, cacBRL: null });
    const ref = r.channels.find((c) => c.channel === "indicacao")!;
    expect(ref).toMatchObject({ leads: 1, won: 1, spendBRL: 0, costPerLeadBRL: null, cacBRL: null });
    // Ordenado por volume de leads.
    expect(r.channels[0].channel).toBe("site");
    expect(r.campaigns).toHaveLength(2);

    const other = await inOrg("B", (tx) => marketingReport(tx, "B", period()));
    expect(other.totals).toMatchObject({ leads: 1, won: 1, wonValueBRL: 99999, spendBRL: 0 });
  });

  it("leads fora da janela não entram", async () => {
    const old = { key: "30d" as const, from: new Date("2020-01-01"), to: new Date("2020-02-01") };
    const r = await inOrg("A", (tx) => marketingReport(tx, "A", old));
    expect(r.totals.leads).toBe(0);
    expect(r.channels).toEqual([]);
  });

  it("tempo de resposta usa o primeiro atendimento; sem atendimento fica como em aberto", async () => {
    const deals = await prisma.opportunity.findMany({ where: { organizationId: "A", status: "OPEN" }, orderBy: { createdAt: "asc" } });
    await prisma.opportunity.update({ where: { id: deals[0].id }, data: { firstResponseAt: new Date(deals[0].createdAt.getTime() + 30 * 60000) } });
    const r = await inOrg("A", (tx) => marketingReport(tx, "A", period()));
    expect(r.response.answered).toBeGreaterThanOrEqual(1);
    expect(r.response.medianMinutes).toBeGreaterThanOrEqual(0);
    expect(r.response.unanswered).toBe(deals.length - 1);
  });
});

describe("tráfego do site", () => {
  it("sem site, devolve vazio e hasSite falso", async () => {
    const t = await inOrg("B", (tx) => siteTraffic(tx, "B", period()));
    expect(t).toMatchObject({ hasSite: false, views: 0, visitors: 0 });
  });

  it("conta visitantes únicos, cliques, formulários (sem spam) e origem", async () => {
    const site = await prisma.site.create({ data: { organizationId: "A", name: "S", draft: {} } });
    const ev = (type: "VIEW" | "CLICK" | "FORM", visitorHash: string, extra: Record<string, unknown> = {}) => ({ organizationId: "A", siteId: site.id, type, visitorHash, ...extra });
    await prisma.siteEvent.createMany({
      data: [
        ev("VIEW", "v1", { path: "/", utmSource: "google" }),
        ev("VIEW", "v1", { path: "/contato", utmSource: "google" }),
        ev("VIEW", "v2", { path: "/", referrerHost: "instagram.com" }),
        ev("VIEW", "v3", { path: "/" }),
        ev("CLICK", "v1", { label: "whatsapp" }),
        ev("CLICK", "v2", { label: "phone" }),
        ev("FORM", "v1", { label: "lead" }),
        ev("FORM", "v9", { label: "spam" }),
      ],
    });
    const t = await inOrg("A", (tx) => siteTraffic(tx, "A", period()));
    expect(t).toMatchObject({ hasSite: true, views: 4, visitors: 3, whatsappClicks: 1, phoneClicks: 1, emailClicks: 0, forms: 1 });
    expect(t.formRate).toBeCloseTo(1 / 3);
    expect(t.topPages[0]).toEqual({ path: "/", views: 3 });
    expect(t.topSources).toEqual(expect.arrayContaining([{ source: "google", visitors: 1 }, { source: "instagram.com", visitors: 1 }, { source: "Direto", visitors: 1 }]));
  });
});
