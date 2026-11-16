import type { Metadata } from "next";
import type { BlogPost, Page, Section } from "@/lib/sites/content";
import type { LoadedSite } from "./source";

import { LOCALE_LABELS, type Locale, MAIN_LOCALE } from "@/lib/sites/content";
import { type Crumb, localHref, pagePath, resolveImage } from "@/components/sites/engine";

export type { Crumb };
export { pagePath };

export function absoluteUrl(site: LoadedSite, path: string): string {
  return `https://${site.primaryHostname}${path}`;
}

/** Image URLs may be site-relative (bundled demo files) or already absolute (CDN). */
function absoluteSrc(site: LoadedSite, src: string): string {
  return /^https?:\/\//.test(src) ? src : absoluteUrl(site, src);
}

/** A main-language path in the site's current language: "/taurus" → "/en/taurus". */
export function localPath(site: LoadedSite, path: string): string {
  return localHref({ locale: site.locale }, path);
}

const OG_LOCALE = { "pt-BR": "pt_BR", en: "en_US", es: "es_ES", ja: "ja_JP" } as const;

/**
 * hreflang: the same page in every language of the site, so Google shows each
 * visitor the right one. Only for sites with more than one language.
 */
function languageAlternates(site: LoadedSite, mainPath: string): Record<string, string> | undefined {
  if (site.languages.length === 0) return undefined;
  const out: Record<string, string> = { [LOCALE_LABELS[MAIN_LOCALE].htmlLang]: absoluteUrl(site, mainPath) };
  for (const l of site.languages) out[LOCALE_LABELS[l].htmlLang] = absoluteUrl(site, localHref({ locale: l }, mainPath));
  out["x-default"] = absoluteUrl(site, mainPath);
  return out;
}

function ctxOf(site: LoadedSite, path: string) {
  return { site: site.content, media: site.media, pagePath: path };
}

function baseMetadata(
  site: LoadedSite,
  opts: { title: string; description?: string; path: string; noindex?: boolean; image?: Page["seo"]["ogImage"]; mainPath?: string },
): Metadata {
  const { content } = site;
  const ctx = ctxOf(site, opts.path);
  const og = resolveImage(ctx, opts.image ?? content.seo.ogImage);
  const favicon = resolveImage(ctx, content.business.favicon);
  const indexable = site.indexable && !opts.noindex;
  const url = absoluteUrl(site, opts.path);
  return {
    title: opts.title,
    description: opts.description,
    // Canonical always points at the primary domain, so temporary and www hosts never compete in Google.
    alternates: { canonical: url, ...(opts.mainPath !== undefined ? { languages: languageAlternates(site, opts.mainPath) } : {}) },
    robots: indexable ? { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } : { index: false, follow: false },
    openGraph: {
      type: "website",
      locale: OG_LOCALE[site.locale],
      ...(site.languages.length ? { alternateLocale: ([MAIN_LOCALE, ...site.languages] as Locale[]).filter((l) => l !== site.locale).map((l) => OG_LOCALE[l]) } : {}),
      siteName: content.business.name,
      title: opts.title,
      description: opts.description,
      url,
      ...(og ? { images: [{ url: absoluteSrc(site, og.src), width: og.width, height: og.height, alt: og.alt }] } : {}),
    },
    // The small size for browser tabs, the large one for phones' home screens (apple-touch-icon).
    ...(favicon ? { icons: { icon: [...new Set([smallestSrc(favicon), favicon.src])].map((url) => ({ url })), apple: favicon.src } } : {}),
  };
}

export function pageMetadata(site: LoadedSite, page: Page): Metadata {
  const title = page.seo.title ?? (page.slug === "" ? site.content.seo.title : `${page.title} | ${site.content.seo.title}`);
  return baseMetadata(site, {
    title,
    description: page.seo.description ?? site.content.seo.description,
    path: localPath(site, pagePath(page.slug)),
    mainPath: pagePath(page.slug),
    noindex: page.seo.noindex,
    image: page.seo.ogImage,
  });
}

export function postMetadata(site: LoadedSite, post: BlogPost, path: string): Metadata {
  const meta = baseMetadata(site, {
    title: post.seo.title ?? `${post.title} | ${site.content.seo.title}`,
    description: post.seo.description ?? post.excerpt,
    path,
    noindex: post.seo.noindex,
    image: post.cover,
  });
  return {
    ...meta,
    ...(post.seo.canonical ? { alternates: { ...meta.alternates, canonical: post.seo.canonical } } : {}),
    openGraph: { ...meta.openGraph, type: "article", publishedTime: post.publishedAt, modifiedTime: post.updatedAt ?? post.publishedAt },
  };
}

export function listingMetadata(site: LoadedSite, title: string, description: string | undefined, path: string): Metadata {
  return baseMetadata(site, { title: `${title} | ${site.content.seo.title}`, description, path });
}

/* ---------- Structured data (Schema.org) ---------- */

type Json = Record<string, unknown>;

/** Escaping "<" keeps operator-typed text from closing the <script> tag. */
export function jsonLd(data: Json | Json[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function orgId(site: LoadedSite) {
  return `${absoluteUrl(site, "/")}#organizacao`;
}

function teamMembers(site: LoadedSite) {
  return site.content.pages
    .flatMap((p) => p.sections)
    .filter((s): s is Extract<Section, { type: "team" }> => s.type === "team" && !s.hidden)
    .flatMap((s) => s.members);
}

/**
 * The business as an entity: what search engines and AI assistants quote when
 * asked about it. Only facts entered in the panel are emitted, never guesses.
 */
export function siteGraph(site: LoadedSite): Json {
  const { business } = site.content;
  const ctx = ctxOf(site, "/");
  const logo = resolveImage(ctx, business.logo);
  const people = teamMembers(site).map((m) => {
    const photo = resolveImage(ctx, m.photo);
    return {
      "@type": "Person",
      name: m.name,
      ...(m.role ? { jobTitle: m.role } : {}),
      ...(photo ? { image: absoluteSrc(site, photo.src) } : {}),
      ...(m.linkedin ? { sameAs: [m.linkedin] } : {}),
      worksFor: { "@id": orgId(site) },
    };
  });
  const founder = people.find((p) => /fundador|fundadora|founder/i.test(String(p.jobTitle ?? "")));

  if (business.entityType === "person") return personGraph(site, ctx);
  // Every page declared as a service (seo.kind) becomes an item of the business's catalog.
  const services = site.content.pages.filter((p) => p.seo.kind === "service" && !p.seo.noindex);

  const organization: Json = {
    "@type": business.complianceMode === "oab" ? "LegalService" : "LocalBusiness",
    "@id": orgId(site),
    name: business.name,
    url: absoluteUrl(site, "/"),
    ...(business.tagline ? { description: business.tagline } : {}),
    ...(logo ? { logo: absoluteSrc(site, logo.src), image: absoluteSrc(site, logo.src) } : {}),
    ...(business.phone ? { telephone: /^550?[3589]00\d{7}$/.test(business.phone) ? business.phone.slice(2).replace(/^(?!0)/, "0") : `+${business.phone}` } : {}),
    ...(business.email ? { email: business.email } : {}),
    ...(business.foundingYear ? { foundingDate: String(business.foundingYear) } : {}),
    ...(business.areasServed.length ? { areaServed: business.areasServed.map((name) => ({ "@type": "Place", name })) } : {}),
    ...(business.expertise.length ? { knowsAbout: business.expertise } : {}),
    ...(business.address
      ? {
          address: {
            "@type": "PostalAddress",
            ...(business.address.street ? { streetAddress: business.address.street } : {}),
            addressLocality: business.address.city,
            addressRegion: business.address.state,
            ...(business.address.postalCode ? { postalCode: business.address.postalCode } : {}),
            addressCountry: "BR",
          },
        }
      : {}),
    ...(business.geo ? { geo: { "@type": "GeoCoordinates", latitude: business.geo.lat, longitude: business.geo.lng } } : {}),
    ...(business.hours.length
      ? { openingHoursSpecification: business.hours.map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: h.days.map((d) => `https://schema.org/${DAY_NAMES[d]}`), opens: h.opens, closes: h.closes })) }
      : {}),
    ...(services.length
      ? { hasOfferCatalog: { "@type": "OfferCatalog", name: "Serviços", itemListElement: services.map((p) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: p.title, url: absoluteUrl(site, pagePath(p.slug)), "@id": `${absoluteUrl(site, pagePath(p.slug))}#servico` } })) } }
      : {}),
    ...(founder ? { founder } : {}),
    ...(people.length ? { employee: people } : {}),
    sameAs: Object.values(business.socials).filter(Boolean),
  };

  return {
    "@context": "https://schema.org",
    "@graph": [
      organization,
      {
        "@type": "WebSite",
        "@id": `${absoluteUrl(site, "/")}#site`,
        url: absoluteUrl(site, "/"),
        name: business.name,
        inLanguage: "pt-BR",
        publisher: { "@id": orgId(site) },
      },
    ],
  };
}

/** Personal-brand site: the entity is the person, linked to the company they lead. */
function personGraph(site: LoadedSite, ctx: ReturnType<typeof ctxOf>): Json {
  const { business, seo } = site.content;
  const image = resolveImage(ctx, seo.ogImage ?? business.logo);
  const person: Json = {
    "@type": "Person",
    "@id": orgId(site),
    name: business.name,
    url: absoluteUrl(site, "/"),
    ...(business.tagline ? { description: business.tagline } : {}),
    ...(business.jobTitle ? { jobTitle: business.jobTitle } : {}),
    ...(image ? { image: absoluteSrc(site, image.src) } : {}),
    ...(business.worksFor ? { worksFor: { "@type": "Organization", name: business.worksFor.name, ...(business.worksFor.url ? { url: business.worksFor.url } : {}) } } : {}),
    ...(business.expertise.length ? { knowsAbout: business.expertise } : {}),
    ...(business.address ? { homeLocation: { "@type": "Place", name: `${business.address.city}, ${business.address.state}` } } : {}),
    sameAs: Object.values(business.socials).filter(Boolean),
  };
  return {
    "@context": "https://schema.org",
    "@graph": [
      person,
      { "@type": "WebSite", "@id": `${absoluteUrl(site, "/")}#site`, url: absoluteUrl(site, "/"), name: business.name, inLanguage: "pt-BR", publisher: { "@id": orgId(site) } },
    ],
  };
}

export function breadcrumbJsonLd(site: LoadedSite, crumbs: Crumb[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, item: absoluteUrl(site, c.href) })),
  };
}

export function faqJsonLd(items: { question: string; answer: string }[]): Json | null {
  if (items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((q) => ({ "@type": "Question", name: q.question, acceptedAnswer: { "@type": "Answer", text: q.answer } })),
  };
}

const DAY_NAMES = { Mo: "Monday", Tu: "Tuesday", We: "Wednesday", Th: "Thursday", Fr: "Friday", Sa: "Saturday", Su: "Sunday" } as const;

const PAGE_TYPES = { page: "WebPage", guide: "WebPage", service: "WebPage", about: "AboutPage", contact: "ContactPage" } as const;

/**
 * The page itself as an entity, linked to the business and the site. A
 * service page also declares the Service it describes, so a question like
 * "quem faz SEO em Jundiaí" can be matched to the page that answers it.
 */
export function webPageJsonLd(site: LoadedSite, page: Page): Json {
  const { business } = site.content;
  const url = absoluteUrl(site, localPath(site, pagePath(page.slug)));
  const kind = page.seo.kind ?? "page";
  const description = page.seo.description ?? (page.slug === "" ? site.content.seo.description : undefined);
  const og = resolveImage(ctxOf(site, pagePath(page.slug)), page.seo.ogImage ?? site.content.seo.ogImage);
  const service: Json | null =
    kind === "service"
      ? {
          "@type": "Service",
          "@id": `${url}#servico`,
          name: page.title,
          serviceType: page.title,
          ...(description ? { description } : {}),
          url,
          provider: { "@id": orgId(site) },
          ...(business.areasServed.length ? { areaServed: business.areasServed.map((name) => ({ "@type": "Place", name })) } : {}),
        }
      : null;
  const webPage: Json = {
    "@type": PAGE_TYPES[kind],
    "@id": `${url}#pagina`,
    url,
    name: page.seo.title ?? page.title,
    ...(description ? { description } : {}),
    inLanguage: LOCALE_LABELS[site.locale].htmlLang,
    isPartOf: { "@id": `${absoluteUrl(site, "/")}#site` },
    ...(og ? { primaryImageOfPage: absoluteSrc(site, og.src) } : {}),
    ...(service ? { mainEntity: { "@id": service["@id"] } } : kind === "about" || kind === "contact" || page.slug === "" ? { about: { "@id": orgId(site) } } : {}),
  };
  return { "@context": "https://schema.org", "@graph": service ? [webPage, service] : [webPage] };
}

/** Questions from every visible FAQ section of a page. */
export function pageFaqs(page: Page): { question: string; answer: string }[] {
  return page.sections.filter((s): s is Extract<Section, { type: "faq" }> => s.type === "faq" && !s.hidden).flatMap((s) => s.items);
}

/** VideoObject for a post with a video (an episode): lets search show it as a video result. Null without one. */
export function videoJsonLd(site: LoadedSite, post: BlogPost, path: string): Json | null {
  if (!post.video) return null;
  const cover = resolveImage(ctxOf(site, path), post.cover);
  const yt = post.video.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1];
  const file = /\.mp4($|\?)/i.test(post.video) ? (post.video.startsWith("/") ? absoluteSrc(site, post.video) : post.video) : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: post.title,
    description: post.excerpt,
    uploadDate: post.publishedAt,
    inLanguage: "pt-BR",
    ...(cover ? { thumbnailUrl: absoluteSrc(site, cover.src) } : yt ? { thumbnailUrl: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` } : {}),
    ...(yt ? { embedUrl: `https://www.youtube.com/embed/${yt}` } : {}),
    ...(file ? { contentUrl: file } : {}),
    url: absoluteUrl(site, path),
    publisher: { "@id": orgId(site) },
  };
}

export function blogPostingJsonLd(site: LoadedSite, post: BlogPost, path: string): Json {
  const cover = resolveImage(ctxOf(site, path), post.cover);
  const category = site.content.blog?.categories.find((c) => c.slug === post.category)?.name;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    inLanguage: "pt-BR",
    mainEntityOfPage: absoluteUrl(site, path),
    ...(cover ? { image: absoluteSrc(site, cover.src) } : {}),
    ...(category ? { articleSection: category } : {}),
    author: post.author && post.author !== site.content.business.name ? { "@type": "Person", name: post.author } : { "@id": orgId(site) },
    publisher: { "@id": orgId(site) },
  };
}

/** The smallest candidate of an image's srcset (or its src). */
function smallestSrc(image: { src: string; srcSet?: string }): string {
  const candidates = (image.srcSet ?? "")
    .split(",")
    .map((part) => part.trim().split(/\s+/))
    .flatMap(([url, width]) => (url && width?.endsWith("w") ? [{ url, width: Number.parseInt(width, 10) }] : []))
    .sort((a, b) => a.width - b.width);
  return candidates[0]?.url ?? image.src;
}
