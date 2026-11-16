import type { BlogPost, Cta, ImageRef, Locale, SiteContent } from "@/lib/sites/content";
import { localHref } from "./i18n";

/** CDN variants of an uploaded image, embedded in the snapshot when a site is published. */
export type ResolvedImage = {
  width: number;
  height: number;
  /** Largest variant, used as `src`. */
  src: string;
  /** e.g. "https://cdn/…-480.avif 480w, https://cdn/…-960.avif 960w" */
  srcSet?: string;
};

export type MediaMap = Record<string, ResolvedImage>;

/** Everything a section needs besides its own fields. */
export type RenderContext = {
  site: SiteContent;
  media: MediaMap;
  /** Path of the page being rendered, e.g. "/" or "/servicos". Used as the lead's origin page. */
  pagePath: string;
  /** Set on the first section of a page that has no hero: its title becomes the page's only <h1>. */
  primaryHeading?: boolean;
  /** Published blog posts, newest first (for the "posts" section and blog pages). */
  posts?: BlogPost[];
  /** Trail shown on inner pages, e.g. Início › Atuação. The last item is the current page. */
  breadcrumbs?: { label: string; href: string }[];
  /** Language being shown; Portuguese when absent. Internal links and platform words follow it. */
  locale?: Locale;
  /** The site's connected Instagram account and its latest posts (the "instagram" section); absent when none is connected. */
  instagram?: InstagramFeed;
};

/** Latest posts of the site's Instagram account; images are copies on our own storage. */
export type InstagramFeed = {
  username: string;
  posts: { id: string; permalink: string; caption: string; mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM"; image: { src: string; width: number; height: number } }[];
};

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
}

/** Stable anchor id for a heading inside an article ("O que é?" → "o-que-e"). */
export function anchorId(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function resolveImage(ctx: RenderContext, ref: ImageRef | undefined): (ResolvedImage & { alt: string }) | null {
  if (!ref) return null;
  const image = ctx.media[ref.assetId];
  return image ? { ...image, alt: ref.alt } : null;
}

export function whatsappUrl(number: string, message?: string): string {
  const text = message?.trim();
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Where a CTA points. WhatsApp CTAs fall back to the contact section when the site has no WhatsApp. */
export function ctaHref(ctx: RenderContext, cta: Cta): string {
  if (cta.action.type === "link") return localHref(ctx, cta.action.href);
  const whatsapp = ctx.site.business.whatsapp;
  if (!whatsapp) return "#contato";
  return whatsappUrl(whatsapp.number, cta.action.message ?? whatsapp.defaultMessage);
}

export function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href);
}
