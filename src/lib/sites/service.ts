import type { Prisma } from "@/generated/prisma/client";
import type { NichePack } from "@/packs/schema";
import { applyBriefingToDocument, buildSiteDocument, type SiteDocument } from "@/lib/sites/builder";
import { parseSiteContent } from "@/lib/sites/content";

type Tx = Prisma.TransactionClient;

export class SiteExistsError extends Error {
  constructor() {
    super("A organização já tem um site.");
    this.name = "SiteExistsError";
  }
}
export class SiteNotFoundError extends Error {
  constructor() {
    super("Site não encontrado.");
    this.name = "SiteNotFoundError";
  }
}
export class SiteInvalidError extends Error {
  constructor(public problems: string[]) {
    super(`O site tem problemas: ${problems.join("; ")}`);
    this.name = "SiteInvalidError";
  }
}

/** Primeira versão: um site por organização (o do próprio cliente). As páginas de captação moram dentro dele. */
export async function getOrgSite(tx: Tx, organizationId: string) {
  return tx.site.findFirst({ where: { organizationId }, orderBy: { createdAt: "asc" }, include: { domains: { orderBy: { createdAt: "asc" } } } });
}

/**
 * Cria o site (rascunho) e o endereço provisório. O `hostname` já chega escolhido e livre: a
 * unicidade é entre TODAS as organizações, que esta transação não enxerga, e consultar outra
 * conexão com a transação aberta seguraria duas conexões ao mesmo tempo.
 */
export async function createSite(
  tx: Tx,
  input: { organizationId: string; pack: NichePack; briefing: unknown; hostname: string },
) {
  if (await getOrgSite(tx, input.organizationId)) throw new SiteExistsError();
  const draft = buildSiteDocument(input.pack, input.briefing);
  const hostname = input.hostname;
  const site = await tx.site.create({
    data: {
      organizationId: input.organizationId,
      name: draft.content.business.name,
      templateKey: input.pack.key,
      draft: draft as unknown as Prisma.InputJsonValue,
      // Nasce fora do Google: a pessoa revisa e só então libera a indexação.
      indexable: false,
    },
  });
  await tx.siteDomain.create({ data: { organizationId: input.organizationId, siteId: site.id, hostname, kind: "SUBDOMAIN", isPrimary: true, status: "ACTIVE" } });
  return { siteId: site.id, hostname };
}

function readDraft(site: { draft: unknown }): SiteDocument {
  const raw = site.draft as { content: unknown; media?: unknown; posts?: unknown };
  return { content: parseSiteContent(raw.content), media: {}, posts: [] };
}

/** Atualiza só os dados do negócio do rascunho (nome, contatos, endereço, cor, rodapé). */
export async function updateDetails(tx: Tx, organizationId: string, siteId: string, pack: NichePack, briefing: unknown) {
  const site = await tx.site.findFirst({ where: { id: siteId, organizationId } });
  if (!site) throw new SiteNotFoundError();
  const next = applyBriefingToDocument(pack, readDraft(site), briefing);
  await tx.site.update({ where: { id: siteId }, data: { name: next.content.business.name, draft: next as unknown as Prisma.InputJsonValue, draftRevision: { increment: 1 } } });
}

/** Refaz as páginas a partir do modelo (descarta os ajustes feitos nelas). */
export async function regenerateFromTemplate(tx: Tx, organizationId: string, siteId: string, pack: NichePack, briefing: unknown) {
  const site = await tx.site.findFirst({ where: { id: siteId, organizationId } });
  if (!site) throw new SiteNotFoundError();
  const draft = buildSiteDocument(pack, briefing);
  await tx.site.update({ where: { id: siteId }, data: { name: draft.content.business.name, templateKey: pack.key, draft: draft as unknown as Prisma.InputJsonValue, draftRevision: { increment: 1 } } });
}

/** Publica o rascunho: valida, grava uma versão imutável e aponta o site para ela. Devolve os domínios para limpar o cache. */
export async function publish(tx: Tx, input: { organizationId: string; userId: string | null; siteId: string }) {
  const site = await tx.site.findFirst({ where: { id: input.siteId, organizationId: input.organizationId }, include: { domains: true } });
  if (!site) throw new SiteNotFoundError();
  let doc: SiteDocument;
  try {
    doc = readDraft(site);
  } catch (e) {
    const issues = (e as { issues?: { path: PropertyKey[]; message: string }[] }).issues;
    throw new SiteInvalidError(issues ? issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) : [(e as Error).message]);
  }
  const last = await tx.siteVersion.findFirst({ where: { siteId: site.id }, orderBy: { version: "desc" }, select: { version: true } });
  const version = await tx.siteVersion.create({
    data: { organizationId: input.organizationId, siteId: site.id, version: (last?.version ?? 0) + 1, content: doc as unknown as Prisma.InputJsonValue, publishedById: input.userId },
  });
  await tx.site.update({ where: { id: site.id }, data: { publishedVersionId: version.id } });
  return { version: version.version, hostnames: site.domains.map((d) => d.hostname) };
}

/** Tira o site do ar (o rascunho e as versões ficam guardados). */
export async function unpublish(tx: Tx, organizationId: string, siteId: string) {
  const site = await tx.site.findFirst({ where: { id: siteId, organizationId }, include: { domains: true } });
  if (!site) throw new SiteNotFoundError();
  await tx.site.update({ where: { id: siteId }, data: { publishedVersionId: null } });
  return { hostnames: site.domains.map((d) => d.hostname) };
}

export async function setIndexable(tx: Tx, organizationId: string, siteId: string, indexable: boolean) {
  const site = await tx.site.findFirst({ where: { id: siteId, organizationId }, include: { domains: true } });
  if (!site) throw new SiteNotFoundError();
  await tx.site.update({ where: { id: siteId }, data: { indexable } });
  return { hostnames: site.domains.map((d) => d.hostname) };
}

/** Lê o rascunho para a tela (devolve null se o JSON estiver inválido, em vez de quebrar a página). */
export function safeDraft(site: { draft: unknown }): SiteDocument | null {
  try {
    return readDraft(site);
  } catch {
    return null;
  }
}
