import { LOCALE_LABELS, type Locale, MAIN_LOCALE } from "@/lib/sites/content";
import { localHref } from "@/components/sites/engine";
import { absoluteUrl, pagePath } from "@/lib/sites/seo";
import { loadSite } from "@/lib/sites/source";

// Per-host output: never prerender (Next treats sitemap/robots paths as static metadata by default).
export const dynamic = "force-dynamic";

/** alternates: every language version of the page (hreflang), including itself. */
function entry(loc: string, lastmod?: string, alternates: [string, string][] = []): string {
  const links = alternates.map(([lang, href]) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${escapeXml(href)}"/>`).join("");
  return `<url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}${links}</url>`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ host: string }> }) {
  const { host } = await params;
  const result = await loadSite(host);
  if (result.status !== "found") return new Response("Not found", { status: 404 });

  const { site } = result;
  const blog = site.content.blog;
  const urls: string[] = [];
  if (site.indexable) {
    const locales: Locale[] = [MAIN_LOCALE, ...site.languages];
    for (const p of site.content.pages) {
      if (p.seo.noindex) continue;
      // The blog has no translated versions.
      if (blog && p.slug === blog.slug) {
        urls.push(entry(absoluteUrl(site, pagePath(p.slug))));
        continue;
      }
      const versions: [string, string][] = locales.map((l) => [LOCALE_LABELS[l].htmlLang, absoluteUrl(site, localHref({ locale: l }, pagePath(p.slug)))]);
      const alternates = site.languages.length ? [...versions, ["x-default", versions[0]![1]] as [string, string]] : [];
      for (const [, href] of versions) urls.push(entry(href, undefined, alternates));
    }
    if (blog) {
      if (!site.content.pages.some((p) => p.slug === blog.slug)) urls.push(entry(absoluteUrl(site, `/${blog.slug}`)));
      const used = new Set(site.posts.map((p) => p.category));
      for (const c of blog.categories) if (used.has(c.slug)) urls.push(entry(absoluteUrl(site, `/${blog.slug}/categoria/${c.slug}`)));
      const usedTags = new Set(site.posts.flatMap((p) => p.tags));
      for (const t of blog.tags) if (usedTags.has(t.slug)) urls.push(entry(absoluteUrl(site, `/${blog.slug}/${blog.tagsPath}/${t.slug}`)));
      for (const post of site.posts) {
        if (!post.seo.noindex) urls.push(entry(absoluteUrl(site, `/${blog.slug}/${post.slug}`), post.updatedAt ?? post.publishedAt));
      }
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join("")}</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
