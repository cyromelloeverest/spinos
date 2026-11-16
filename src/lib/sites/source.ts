import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import {
  type BlogPost,
  type ExtraLocale,
  type Locale,
  MAIN_LOCALE,
  type SiteContent,
  type SiteTranslation,
  localizeContent,
  parseBlogPosts,
  parseSiteContent,
  parseTranslations,
  publishedPosts,
} from "@/lib/sites/content";
import type { InstagramFeed, MediaMap } from "@/components/sites/engine";
import { prismaAdmin } from "@/lib/prisma-admin";

export type LoadedSite = {
  organizationId: string;
  siteId: string;
  hostname: string;
  primaryHostname: string;
  indexable: boolean;
  content: SiteContent;
  media: MediaMap;
  /** Posts publicados do blog, mais novos primeiro; vazio quando o site não tem blog. */
  posts: BlogPost[];
  locale: Locale;
  /** Prefixo da língua na URL: "" para português, "/en", "/es". */
  basePath: string;
  languages: ExtraLocale[];
  /** Conteúdo na língua principal, para dados que não dependem da língua (hreflang, sitemap). */
  main: SiteContent;
  translations: Partial<Record<ExtraLocale, SiteTranslation>>;
  instagram?: InstagramFeed;
};

export type SiteResult = { status: "found"; site: LoadedSite } | { status: "not_found" };

/*
 * Etiquetas de cache: cada leitura de um site leva a etiqueta do domínio pelo qual foi
 * servida, para a publicação poder limpar o site inteiro (todos os seus domínios).
 */
export const ALL_SITES_TAG = "sites";
export const hostTag = (hostname: string) => `site-host:${hostname}`;

// Cada deploy tem as próprias entradas de cache: uma atualização de código começa limpa.
const DEPLOYMENT = process.env.VERCEL_DEPLOYMENT_ID ?? "local";

type Published = { organizationId: string; siteId: string; primaryHostname: string; indexable: boolean; version: unknown };

// Leitura pública do que está PUBLICADO, por domínio. Usa o papel administrativo (não há
// organização no contexto de quem visita) e só devolve a versão publicada, nunca o rascunho.
async function findPublishedByHostname(hostname: string): Promise<Published | null> {
  const domain = await prismaAdmin.siteDomain.findUnique({ where: { hostname }, include: { site: true } });
  if (!domain?.site.publishedVersionId) return null;
  const version = await prismaAdmin.siteVersion.findUnique({ where: { id: domain.site.publishedVersionId } });
  if (!version) return null;
  const primary = await prismaAdmin.siteDomain.findFirst({ where: { siteId: domain.siteId, isPrimary: true }, select: { hostname: true } });
  return { organizationId: domain.organizationId, siteId: domain.siteId, primaryHostname: primary?.hostname ?? hostname, indexable: domain.site.indexable, version: version.content };
}

function lookupPublished(hostname: string) {
  return unstable_cache(() => findPublishedByHostname(hostname), ["published-site", DEPLOYMENT, hostname], { tags: [hostTag(hostname), ALL_SITES_TAG], revalidate: 86400 })();
}

/** Deduplicado por requisição: layout, página e metadados chamam. */
export const loadSite = cache(async (hostname: string): Promise<SiteResult> => {
  const published = await lookupPublished(hostname.toLowerCase());
  if (!published) return { status: "not_found" };
  return { status: "found", site: fromSnapshot(published, hostname.toLowerCase()) };
});

function fromSnapshot(site: Published, hostname: string): LoadedSite {
  const snapshot = site.version as { content: unknown; media?: MediaMap; posts?: unknown; translations?: unknown };
  const content = parseSiteContent(snapshot.content);
  let translations: Partial<Record<ExtraLocale, SiteTranslation>> = {};
  try {
    translations = parseTranslations(snapshot.translations, content);
  } catch (error) {
    // Uma tradução quebrada nunca derruba o site principal.
    console.error("[i18n] tradução ignorada", site.siteId, error);
  }
  return {
    organizationId: site.organizationId,
    siteId: site.siteId,
    hostname,
    primaryHostname: site.primaryHostname,
    indexable: site.indexable,
    content,
    media: snapshot.media ?? {},
    posts: content.blog ? publishedPosts(parseBlogPosts(snapshot.posts ?? [], content.blog)) : [],
    locale: MAIN_LOCALE,
    basePath: "",
    languages: content.languages.filter((l) => translations[l]),
    main: content,
    translations,
  };
}

/** O mesmo site em outra língua (ou ele mesmo quando essa língua não tem tradução). */
export function inLocale(site: LoadedSite, locale: Locale): LoadedSite {
  if (locale === MAIN_LOCALE || !site.languages.includes(locale)) return site;
  const translation = site.translations[locale]!;
  return { ...site, locale, basePath: `/${locale}`, content: localizeContent(site.main, translation), posts: [] };
}

/** "/en/taurus" → inglês e "taurus"; o resto fica em português. */
export function splitLocale(site: LoadedSite, segments: string[]): { locale: Locale; rest: string[] } {
  const first = segments[0] as ExtraLocale | undefined;
  if (first && site.languages.includes(first)) return { locale: first, rest: segments.slice(1) };
  return { locale: MAIN_LOCALE, rest: segments };
}

// Redirecionamentos por site ficam para depois: um site novo não tem URL antiga.
export async function loadRedirect(_siteId: string, _path: string): Promise<{ toPath: string; statusCode: number } | null> {
  return null;
}
