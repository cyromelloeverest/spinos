import type { BlogPost, Page, SiteContent } from "@/lib/sites/content";

export type Crumb = { label: string; href: string };

export const PRIVACY_SLUG = "privacidade";
export const TERMS_SLUG = "termos-de-uso";
/** Posts per blog listing page; page 2 onwards lives at "<listing>/pagina/<n>". */
export const POSTS_PER_PAGE = 12;

/** How many listing pages a set of posts fills (at least one, so an empty blog still has its index). */
export function blogPageCount(posts: number): number {
  return Math.max(1, Math.ceil(posts / POSTS_PER_PAGE));
}
const HOME: Crumb = { label: "Início", href: "/" };

export function pagePath(slug: string): string {
  return slug === "" ? "/" : `/${slug}`;
}

/** What a URL points to. Shared by the public sites and the admin preview so both resolve paths the same way. */
export type Route =
  | { kind: "page"; page: Page; crumbs: Crumb[] }
  | { kind: "blog"; category?: { slug: string; name: string; description?: string }; tag?: { slug: string; name: string; description?: string }; page: number; crumbs: Crumb[] }
  | { kind: "post"; post: BlogPost; crumbs: Crumb[] }
  | { kind: "privacy" }
  | { kind: "terms" }
  | { kind: "missing"; path: string };

/** `path` has no leading slash: "" for the home page, "insights/um-artigo" for a post. */
export function resolveRoute(content: SiteContent, posts: BlogPost[], path: string): Route {
  const blog = content.blog;
  if (blog && (path === blog.slug || path.startsWith(`${blog.slug}/`))) {
    const index: Crumb = { label: blog.title, href: `/${blog.slug}` };
    let rest = path.slice(blog.slug.length + 1);
    // "…/pagina/3": a later page of the same listing. Page 1 only exists without the suffix.
    const paged = rest.match(/^(?:(.*)\/)?pagina\/(\d+)$/);
    const page = paged ? Number(paged[2]) : 1;
    if (paged) {
      if (page < 2) return { kind: "missing", path };
      rest = paged[1] ?? "";
    }
    if (rest === "") return { kind: "blog", page, crumbs: [HOME, index] };
    const category = rest.match(/^categoria\/([a-z0-9-]+)$/)?.[1];
    if (category) {
      const found = blog.categories.find((c) => c.slug === category);
      return found ? { kind: "blog", category: found, page, crumbs: [HOME, index, { label: found.name, href: `/${blog.slug}/${rest}` }] } : { kind: "missing", path };
    }
    const tagSlug = rest.match(new RegExp(`^${blog.tagsPath ?? "tag"}/([a-z0-9-]+)$`))?.[1];
    if (tagSlug) {
      const tag = (blog.tags ?? []).find((t) => t.slug === tagSlug);
      return tag ? { kind: "blog", tag, page, crumbs: [HOME, index, { label: tag.name, href: `/${blog.slug}/${rest}` }] } : { kind: "missing", path };
    }
    if (paged) return { kind: "missing", path };
    const post = posts.find((p) => p.slug === rest);
    return post ? { kind: "post", post, crumbs: [HOME, index, { label: post.title, href: `/${path}` }] } : { kind: "missing", path };
  }
  const page = content.pages.find((p) => p.slug === path);
  if (page) {
    if (page.slug === "") return { kind: "page", page, crumbs: [HOME] };
    // A nested page ("solucoes/seo") shows its parent in the trail when the parent exists.
    const parentSlug = page.slug.includes("/") ? page.slug.slice(0, page.slug.indexOf("/")) : null;
    const parent = parentSlug ? content.pages.find((p) => p.slug === parentSlug) : undefined;
    const trail = parent ? [{ label: parent.title, href: pagePath(parent.slug) }] : [];
    return { kind: "page", page, crumbs: [HOME, ...trail, { label: page.title, href: pagePath(page.slug) }] };
  }
  if (path === PRIVACY_SLUG) return { kind: "privacy" };
  if (path === TERMS_SLUG) return { kind: "terms" };
  return { kind: "missing", path };
}
