import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";

const h = vi.hoisted(() => ({ prisma: null as unknown }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return h.prisma; } }));
vi.mock("@/lib/prisma-admin", () => ({ get prismaAdmin() { return h.prisma; } }));
vi.mock("@/lib/log-error", () => ({ logError: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn, revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T>(fn: T) => fn }));

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createPrismaOnPglite } from "@/lib/db/pglite-harness";
import type { PrismaClient } from "@/generated/prisma/client";
import { getPack } from "@/packs/registry";
import { createSite, getOrgSite, publish, regenerateFromTemplate, safeDraft, setIndexable, SiteExistsError, SiteInvalidError, unpublish, updateDetails } from "./service";
import { loadSite } from "./source";
import { saveLead } from "./inquiry";
import { SectionList } from "@/components/sites/engine";

let db: PGlite;
let prisma: PrismaClient;

async function inOrg<T>(orgId: string, fn: (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL ROLE spinos_app");
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, true)`;
    return fn(tx);
  });
}

const briefing = { name: "Escritório Exemplo", city: "Jundiaí", state: "SP", whatsapp: "(11) 98765-4321", responsibleName: "Maria Souza", registration: "CRC 1SP123456/O-0", email: "contato@exemplo.com.br" };
const pack = () => getPack("contabilidade")!;
const taken = new Set<string>();
const pickHostname = async (label: string) => {
  let host = `${label}.sites.spinos.com.br`;
  for (let n = 2; taken.has(host); n++) host = `${label}-${n}.sites.spinos.com.br`;
  taken.add(host);
  return host;
};

beforeAll(async () => {
  const r = await createPrismaOnPglite();
  db = r.db;
  prisma = r.prisma;
  h.prisma = prisma;
  await prisma.user.create({ data: { id: "u1", email: "u1@x.com", name: "Maria" } });
  for (const id of ["A", "B"]) await prisma.organization.create({ data: { id, name: `Org ${id}` } });
  await prisma.membership.create({ data: { userId: "u1", organizationId: "A", role: "OWNER" } });
}, 60_000);
afterAll(async () => {
  await prisma.$disconnect();
  await db.close();
});

describe("site: criar, publicar e servir", () => {
  let siteId = "";
  let hostname = "";

  it("cria o site como rascunho, fora do ar e fora do Google, com endereço provisório", async () => {
    const free = await pickHostname("escritorio-exemplo");
    const created = await inOrg("A", (tx) => createSite(tx, { organizationId: "A", pack: pack(), briefing, hostname: free }));
    siteId = created.siteId;
    hostname = created.hostname;
    expect(hostname).toBe("escritorio-exemplo.sites.spinos.com.br");
    const site = await inOrg("A", (tx) => getOrgSite(tx, "A"));
    expect(site?.publishedVersionId).toBeNull();
    expect(site?.indexable).toBe(false);
    expect(site?.domains).toHaveLength(1);
    expect(site?.domains[0]).toMatchObject({ kind: "SUBDOMAIN", isPrimary: true, status: "ACTIVE" });
    expect(safeDraft(site!)?.content.pages.length).toBeGreaterThan(3);
    // Antes de publicar, o domínio não mostra nada.
    expect(await loadSite(hostname)).toEqual({ status: "not_found" });
  });

  it("não cria um segundo site na mesma organização", async () => {
    const other = await pickHostname("outro");
    await expect(inOrg("A", (tx) => createSite(tx, { organizationId: "A", pack: pack(), briefing, hostname: other }))).rejects.toBeInstanceOf(SiteExistsError);
  });

  it("publica: a versão fica gravada e o domínio passa a servir o site", async () => {
    const out = await inOrg("A", (tx) => publish(tx, { organizationId: "A", userId: "u1", siteId }));
    expect(out).toEqual({ version: 1, hostnames: [hostname] });
    const loaded = await loadSite(hostname);
    expect(loaded.status).toBe("found");
    if (loaded.status !== "found") return;
    expect(loaded.site.organizationId).toBe("A");
    expect(loaded.site.indexable).toBe(false);
    expect(loaded.site.content.business.name).toBe("Escritório Exemplo");
    const landing = loaded.site.content.pages.find((p) => p.slug === "troca-de-contador")!;
    // A página realmente renderiza (HTML de verdade, com o texto e sem variável solta).
    const html = renderToStaticMarkup(createElement(SectionList, { sections: landing.sections, ctx: { site: loaded.site.content, media: {}, pagePath: "/troca-de-contador", posts: [], locale: "pt-BR" } as never }));
    expect(html).toContain("Troca de contador");
    expect(html).not.toContain("{{");
  });

  it("edição do rascunho depois de publicar não muda o que está no ar até publicar de novo", async () => {
    await inOrg("A", (tx) => updateDetails(tx, "A", siteId, pack(), { ...briefing, name: "Escritório Novo Nome" }));
    const live = await loadSite(hostname);
    expect(live.status === "found" && live.site.content.business.name).toBe("Escritório Exemplo");
    const out = await inOrg("A", (tx) => publish(tx, { organizationId: "A", userId: "u1", siteId }));
    expect(out.version).toBe(2);
    const after = await loadSite(hostname);
    expect(after.status === "found" && after.site.content.business.name).toBe("Escritório Novo Nome");
  });

  it("tirar do ar devolve 404 sem apagar o rascunho nem as versões", async () => {
    await inOrg("A", (tx) => unpublish(tx, "A", siteId));
    expect(await loadSite(hostname)).toEqual({ status: "not_found" });
    expect(await prisma.siteVersion.count({ where: { siteId } })).toBe(2);
    await inOrg("A", (tx) => publish(tx, { organizationId: "A", userId: "u1", siteId }));
    expect((await loadSite(hostname)).status).toBe("found");
  });

  it("liberar para o Google só muda a indexação", async () => {
    await inOrg("A", (tx) => setIndexable(tx, "A", siteId, true));
    const loaded = await loadSite(hostname);
    expect(loaded.status === "found" && loaded.site.indexable).toBe(true);
  });

  it("refazer a partir do modelo descarta os ajustes do rascunho", async () => {
    await inOrg("A", (tx) => regenerateFromTemplate(tx, "A", siteId, pack(), briefing));
    const site = await inOrg("A", (tx) => getOrgSite(tx, "A"));
    expect(safeDraft(site!)?.content.business.name).toBe("Escritório Exemplo");
  });

  it("publicar rascunho corrompido é recusado com a lista de problemas", async () => {
    await prisma.site.update({ where: { id: siteId }, data: { draft: { content: { schemaVersion: 1, pages: [] } } } });
    await expect(inOrg("A", (tx) => publish(tx, { organizationId: "A", userId: "u1", siteId }))).rejects.toBeInstanceOf(SiteInvalidError);
    // O que estava no ar continua no ar.
    expect((await loadSite(hostname)).status).toBe("found");
  });

  it("outra organização não enxerga nem publica o site (RLS e filtro)", async () => {
    expect(await inOrg("B", (tx) => getOrgSite(tx, "B"))).toBeNull();
    await expect(inOrg("B", (tx) => publish(tx, { organizationId: "B", userId: null, siteId }))).rejects.toThrow();
  });
});

describe("lead vindo do site entra no CRM da organização dona", () => {
  it("cria conta, contato e negociação com a origem do site e a base legal", async () => {
    const site = await prisma.site.findFirstOrThrow({ where: { organizationId: "A" } });
    const result = await saveLead({
      organizationId: "A", siteId: site.id, host: "escritorio-exemplo.sites.spinos.com.br", name: "João Cliente", company: "Padaria do João", phone: "11999998888", email: "joao@padaria.com.br",
      message: "Quero abrir uma empresa", pagePath: "/abertura-de-empresa", source: "site", utmSource: "google", utmMedium: "cpc", utmCampaign: "abertura", ipHash: "hash1", attribution: { gclid: "abc123" }, consentText: "Enviou o formulário",
    });
    expect(result).toBe("saved");
    const deals = await prisma.opportunity.findMany({ where: { organizationId: "A" }, include: { account: true } });
    expect(deals).toHaveLength(1);
    expect(deals[0].account.name).toContain("Padaria do João");
    const origin = await prisma.origin.findFirstOrThrow({ where: { organizationId: "A", accountId: deals[0].accountId } });
    expect(origin).toMatchObject({ isFirstTouch: true, channel: "google_ads", utmSource: "google", gclid: "abc123", landingPageId: site.id });
    const contact = await prisma.contact.findFirstOrThrow({ where: { organizationId: "A", accountId: deals[0].accountId } });
    expect(contact.legalBasis).toBe("CONSENT");
    expect(await prisma.activity.count({ where: { organizationId: "A", opportunityId: deals[0].id } })).toBeGreaterThan(0);
    // Nada vazou para outra organização.
    expect(await prisma.opportunity.count({ where: { organizationId: "B" } })).toBe(0);
  });

  it("mesma pessoa de novo vira novo toque de origem, não conta duplicada", async () => {
    const site = await prisma.site.findFirstOrThrow({ where: { organizationId: "A" } });
    const result = await saveLead({
      organizationId: "A", siteId: site.id, host: "x", name: "João Cliente", phone: "11999998888", email: "joao@padaria.com.br", message: "De novo", pagePath: "/contato", source: "site",
      utmSource: null, utmMedium: null, utmCampaign: null, ipHash: "hash2", attribution: null,
    });
    expect(result).toBe("duplicate");
    expect(await prisma.account.count({ where: { organizationId: "A" } })).toBe(1);
    expect(await prisma.origin.count({ where: { organizationId: "A" } })).toBe(2);
  });

  it("spam é só contado, nunca vira lead", async () => {
    const site = await prisma.site.findFirstOrThrow({ where: { organizationId: "A" } });
    const before = await prisma.opportunity.count({ where: { organizationId: "A" } });
    const result = await saveLead({ organizationId: "A", siteId: site.id, host: "x", name: "Robô", phone: "11911112222", pagePath: "/", source: "spam", utmSource: null, utmMedium: null, utmCampaign: null, ipHash: "hash3", attribution: null });
    expect(result).toBe("spam");
    expect(await prisma.opportunity.count({ where: { organizationId: "A" } })).toBe(before);
  });
});
