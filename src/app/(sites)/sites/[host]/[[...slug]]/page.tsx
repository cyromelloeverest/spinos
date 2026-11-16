import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { BlogIndexView, BlogPostView, type Crumb, SectionList, blogListing, blogPageCount, localHref, pagePath, resolveRoute, ui } from "@/components/sites/engine";
import { PrivacyPolicy } from "@/lib/sites/privacy";
import { TermsOfUse } from "@/lib/sites/terms";
import {
  blogPostingJsonLd,
  videoJsonLd,
  breadcrumbJsonLd,
  faqJsonLd,
  jsonLd,
  listingMetadata,
  pageFaqs,
  pageMetadata,
  postMetadata,
  webPageJsonLd,
} from "@/lib/sites/seo";
import { inLocale, loadRedirect, loadSite, splitLocale } from "@/lib/sites/source";

type Props = {
  params: Promise<{ host: string; slug?: string[] }>;
};

/*
 * Pages are rendered once and kept in Vercel's cache (ISR), so visitors are
 * served from the CDN and never reach the database. A publish in the panel or
 * the "Limpar cache" button clears them at once (tags in lib/site-source.ts);
 * a new deployment starts with an empty cache; a day is the safety net.
 */
export const revalidate = 86400;
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

async function resolve(params: Props["params"]) {
  const { host, slug = [] } = await params;
  const result = await loadSite(host);
  if (result.status !== "found") notFound();
  // "/en/taurus": the English site, page "taurus". Portuguese has no prefix.
  const { locale, rest } = splitLocale(result.site, slug);
  const site = inLocale(result.site, locale);
  const path = rest.join("/");
  const route = resolveRoute(site.content, site.posts, path);
  // Breadcrumbs in the page's language: "Início" becomes "Home", links keep the prefix.
  if ("crumbs" in route) {
    route.crumbs = route.crumbs.map((c: Crumb, i: number) => ({ label: i === 0 ? ui({ locale }).home : c.label, href: localHref({ locale }, c.href) }));
  }
  return { site, path, route };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { site, path, route: r } = await resolve(params);
  switch (r.kind) {
    case "page":
      return pageMetadata(site, r.page);
    case "post":
      return postMetadata(site, r.post, `/${path}`);
    case "blog":
      return listingMetadata(
        site,
        `${r.tag?.name ?? r.category?.name ?? site.content.blog!.title}${r.page > 1 ? ` · Página ${r.page}` : ""}`,
        r.tag?.description ?? r.category?.description ?? site.content.blog!.intro,
        `/${path}`,
      );
    case "privacy":
      return { title: `${ui({ locale: site.locale }).privacyPolicy} | ${site.content.seo.title}`, robots: { index: false } };
    case "terms":
      return { title: `${ui({ locale: site.locale }).termsOfUse} | ${site.content.seo.title}`, robots: { index: false } };
    default:
      return {};
  }
}

function StructuredData({ data }: { data: (Record<string, unknown> | null)[] }) {
  const items = data.filter((d): d is Record<string, unknown> => d !== null);
  return items.length > 0 ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(items) }} /> : null;
}

export default async function SitePage({ params }: Props) {
  const { site, path, route: r } = await resolve(params);
  const base = { site: site.content, media: site.media, posts: site.posts, locale: site.locale, instagram: site.instagram };

  switch (r.kind) {
    case "privacy":
      return <PrivacyPolicy site={site} />;

    case "terms":
      return <TermsOfUse site={site} />;

    case "missing": {
      const redirect = site.basePath ? null : await loadRedirect(site.siteId, `/${r.path}`);
      if (redirect) permanentRedirect(redirect.toPath);
      notFound();
    }

    case "blog": {
      // A page number past the last page is a dead URL, not an empty listing.
      if (r.page > blogPageCount(blogListing(site.posts, r.category?.slug, r.tag?.slug).length)) notFound();
      const ctx = { ...base, pagePath: `/${path}`, breadcrumbs: r.crumbs };
      return (
        <>
          <BlogIndexView ctx={ctx} category={r.category?.slug} tag={r.tag?.slug} page={r.page} />
          <StructuredData data={[breadcrumbJsonLd(site, r.crumbs)]} />
        </>
      );
    }

    case "post": {
      const ctx = { ...base, pagePath: `/${path}`, breadcrumbs: r.crumbs };
      return (
        <>
          <BlogPostView ctx={ctx} post={r.post} />
          <StructuredData data={[blogPostingJsonLd(site, r.post, `/${path}`), videoJsonLd(site, r.post, `/${path}`), breadcrumbJsonLd(site, r.crumbs), faqJsonLd(r.post.faq)]} />
        </>
      );
    }

    case "page": {
      // The form result (?enviado / ?erro) is shown by the browser: the page stays the same for everyone.
      const ctx = { ...base, pagePath: localHref(base, pagePath(r.page.slug)), breadcrumbs: r.crumbs };
      return (
        <>
          <SectionList sections={r.page.sections} ctx={ctx} />
          <StructuredData data={[webPageJsonLd(site, r.page), r.crumbs.length > 1 ? breadcrumbJsonLd(site, r.crumbs) : null, faqJsonLd(pageFaqs(r.page))]} />
        </>
      );
    }
  }
}
