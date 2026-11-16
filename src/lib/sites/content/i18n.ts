import { z } from "zod";
import { optionalText, shortText } from "./primitives";
import { type SiteContent, page, siteContent } from "./site";

/*
 * Multilingual sites. Portuguese is the main language; each extra language is
 * a translation of the texts, stored beside the content (like the blog posts).
 * A translation repeats the pages with the same slugs, section ids, images
 * and links, only the words change; anything else comes from the main
 * content, so a translation can never change the theme, the contact data
 * or the integrations.
 */

export const MAIN_LOCALE = "pt-BR";
export const EXTRA_LOCALES = ["en", "es", "ja"] as const;
export type ExtraLocale = (typeof EXTRA_LOCALES)[number];
export type Locale = typeof MAIN_LOCALE | ExtraLocale;

/** Name of each language in itself, for the switcher. */
export const LOCALE_LABELS: Record<Locale, { short: string; name: string; htmlLang: string }> = {
  "pt-BR": { short: "PT", name: "Português", htmlLang: "pt-BR" },
  en: { short: "EN", name: "English", htmlLang: "en" },
  es: { short: "ES", name: "Español", htmlLang: "es" },
  ja: { short: "日本語", name: "日本語", htmlLang: "ja" },
};

export const siteTranslation = z.object({
  business: z
    .object({
      tagline: optionalText(160),
      openingHours: optionalText(160),
      whatsappMessage: optionalText(300),
      /** Text of the fixed button in the header. */
      headerCtaLabel: optionalText(40),
    })
    .prefault({}),
  seo: z.object({ title: shortText(70), description: optionalText(170) }),
  pages: z.array(page).min(1).max(60),
});
export type SiteTranslation = z.infer<typeof siteTranslation>;

/** The site's content in one language: the main content with the translated texts on top. */
export function localizeContent(main: SiteContent, translation: SiteTranslation): SiteContent {
  // The blog is published in the main language only, so its page leaves the translated menus too.
  const pages = main.pages
    .filter((p) => !main.blog || p.slug !== main.blog.slug)
    .map((p) => translation.pages.find((t) => t.slug === p.slug) ?? p);
  return siteContent.parse({
    ...main,
    business: {
      ...main.business,
      ...(translation.business.tagline ? { tagline: translation.business.tagline } : {}),
      ...(translation.business.openingHours ? { openingHours: translation.business.openingHours } : {}),
      ...(main.business.whatsapp && translation.business.whatsappMessage
        ? { whatsapp: { ...main.business.whatsapp, defaultMessage: translation.business.whatsappMessage } }
        : {}),
    },
    theme:
      main.theme.headerCta && translation.business.headerCtaLabel
        ? { ...main.theme, headerCta: { ...main.theme.headerCta, label: translation.business.headerCtaLabel } }
        : main.theme,
    seo: { ...main.seo, title: translation.seo.title, description: translation.seo.description },
    pages,
    blog: undefined,
  });
}

/** Translations that match the site's languages and pages; problems are reported, never silently published. */
export function parseTranslations(input: unknown, main: SiteContent): Partial<Record<ExtraLocale, SiteTranslation>> {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Partial<Record<ExtraLocale, SiteTranslation>> = {};
  for (const locale of main.languages) {
    if (!raw[locale]) continue;
    const t = siteTranslation.parse(raw[locale]);
    const slugs = new Set(main.pages.map((p) => p.slug));
    for (const p of t.pages) if (!slugs.has(p.slug)) throw new Error(`Tradução ${locale}: a página /${p.slug} não existe no site principal`);
    out[locale] = t;
  }
  return out;
}
