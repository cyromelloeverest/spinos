import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";
import { preload } from "react-dom";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader, WhatsAppCapture, MobileBar, WhatsAppFloat, themeVariables } from "@/components/sites/engine";
import { CookieConsent } from "@/components/sites/cookie-consent";
import { SiteAnalytics } from "@/components/sites/site-analytics";
import { customFontFaces, customFontVariables, fontPairVariables, fontVariables } from "@/lib/sites/fonts";
import { jsonLd, siteGraph } from "@/lib/sites/seo";
import { inLocale, loadSite, splitLocale } from "@/lib/sites/source";
import { LOCALE_LABELS } from "@/lib/sites/content";

export async function generateMetadata({ params }: { params: Promise<{ host: string }> }): Promise<Metadata> {
  const result = await loadSite((await params).host);
  const google = result.status === "found" ? result.site.content.integrations.googleVerification : undefined;
  return google ? { verification: { google } } : {};
}

/** Browser chrome color on phones: the site's dark tone in dark mode, otherwise its brand color. */
export async function generateViewport({ params }: { params: Promise<{ host: string }> }): Promise<Viewport> {
  const result = await loadSite((await params).host);
  if (result.status !== "found") return {};
  const { theme } = result.site.content;
  return { themeColor: theme.mode === "dark" ? (theme.dark ?? "#0b0d12") : theme.colors.primary };
}

export default async function SiteLayout({ children, params }: { children: ReactNode; params: Promise<{ host: string; slug?: string[] }> }) {
  const { host, slug = [] } = await params;
  const result = await loadSite(host);
  if (result.status !== "found") notFound();

  // The visible path, from the route itself (never a request header, so the page can be cached):
  // the menu item to mark and the language ("/en/…").
  const path = `/${slug.join("/")}`;
  const site = inLocale(result.site, splitLocale(result.site, slug).locale);
  // The theme's texture tile (e.g. the brand monogram), for styles that draw one.
  const pattern = site.content.theme.pattern ? site.media[site.content.theme.pattern.assetId] : undefined;
  const style = {
    ...themeVariables(site.content.theme),
    ...fontPairVariables(site.content.theme.fontPair),
    ...customFontVariables(site.content.theme.customFont, site.content.theme.fontPair),
    // "weight" headlines: light headings with the highlight in bold, also on styles that fix a heading weight.
    ...(site.content.theme.headlineStyle === "weight" ? { "--font-heading-weight": "300" } : {}),
    // Tiles are exported at 2x: drawn at half their pixel width.
    ...(pattern ? { "--pattern-image": `url("${pattern.src}")`, "--pattern-size": `${Math.round(pattern.width / 2)}px` } : {}),
  } as CSSProperties;
  const ctx = { site: site.content, media: site.media, pagePath: path, posts: site.posts, locale: site.locale, instagram: site.instagram };
  const customFont = site.content.theme.customFont;
  // The text weights load first; the rest arrive on demand.
  for (const f of customFont?.files ?? []) if (f.weight === 400 || f.weight === 600) preload(f.src, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });

  return (
    <div lang={LOCALE_LABELS[site.locale].htmlLang} className={`site-shell min-h-screen font-sans ${fontVariables}`} style={style} data-theme={site.content.theme.mode} data-style={site.content.theme.style}>
        {customFont && <style dangerouslySetInnerHTML={{ __html: customFontFaces(customFont) }} />}
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded focus:bg-surface focus:px-4 focus:py-2">
          {{ "pt-BR": "Pular para o conteúdo", en: "Skip to content", es: "Saltar al contenido", ja: "本文へスキップ" }[site.locale]}
        </a>
        <SiteHeader ctx={ctx} />
        <main id="conteudo">{children}</main>
        <SiteFooter ctx={ctx} />
        <WhatsAppFloat ctx={ctx} />
        <MobileBar ctx={ctx} />
        <WhatsAppCapture ctx={ctx} />
        <CookieConsent integrations={site.content.integrations} locale={site.locale} policyHref={`${site.basePath}/privacidade`} />
        <SiteAnalytics />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(siteGraph(site)) }} />
    </div>
  );
}
