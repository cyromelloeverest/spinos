import { z } from "zod";
import { cta, href, imageRef, optionalText, paragraph, shortText } from "./primitives";

/*
 * Blog ("Insights"): posts are structured blocks, never HTML, so the same
 * rules that stop XSS on pages apply to articles. Posts live beside the site
 * content (not inside it) because a blog grows independently of the pages.
 */

const kebab = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífen").max(120);

export const blogBlock = z.discriminatedUnion("type", [
  z.object({ type: z.literal("p"), text: paragraph(4000) }),
  z.object({ type: z.literal("h2"), text: shortText(200) }),
  z.object({ type: z.literal("h3"), text: shortText(200) }),
  z.object({ type: z.literal("ul"), items: z.array(paragraph(800)).min(1).max(40) }),
  z.object({ type: z.literal("ol"), items: z.array(paragraph(800)).min(1).max(40) }),
  z.object({ type: z.literal("quote"), text: paragraph(1500), cite: optionalText(200) }),
  /** One photo across the column, or several as a gallery (e.g. the stand at a fair, a machine installed). */
  z.object({
    type: z.literal("images"),
    images: z.array(imageRef).min(1).max(12),
    caption: optionalText(200),
    /** "medium": one photo at about two thirds of the column, whole and centred (e.g. a machine cut-out). */
    size: z.enum(["full", "medium"]).default("full"),
  }),
  /** A plain data table: the first row is its header; a cell may span several columns. */
  z.object({
    type: z.literal("table"),
    rows: z.array(z.array(z.object({ text: paragraph(600), span: z.number().int().min(1).max(12).default(1) })).min(1).max(12)).min(1).max(60),
  }),
]);
export type BlogBlock = z.infer<typeof blogBlock>;

export const faqItem = z.object({ question: shortText(200), answer: paragraph(1500) });

export const blogPost = z.object({
  slug: kebab,
  /** Drafts are visible in the admin preview only; publishing the site never takes them live. */
  status: z.enum(["draft", "published"]).default("published"),
  title: shortText(160),
  /** One or two sentences: used in listings, meta description and AI summaries. */
  excerpt: shortText(320),
  category: kebab,
  author: optionalText(120),
  cover: imageRef.optional(),
  publishedAt: z.iso.date(),
  updatedAt: z.iso.date().optional(),
  seo: z
    .object({
      title: optionalText(70),
      description: optionalText(170),
      noindex: z.boolean().default(false),
      /** Republished article: the original address, so search engines credit the source and see no duplicate. */
      canonical: z.url({ protocol: /^https$/ }).max(500).optional(),
    })
    .prefault({}),
  body: z.array(blogBlock).min(1).max(400),
  /**
   * The post's video (a YouTube or Shorts link, or an https/site .mp4): shown at the top of the post, in place of
   * the cover, and marked up as VideoObject. In a "videos" blog it is the episode itself.
   */
  video: href.optional(),
  /** Episode number in a "videos" blog: shown on the card and the post ("Ep. 3"). */
  /** A short label on the episode card, e.g. the lesson's subject ("Parcelamento"). */
  badge: optionalText(30),
  episode: z.number().int().min(1).max(9999).optional(),
  /** Slugs of the blog's tags (e.g. the characters in an episode); each tag has its own listing page. */
  tags: z.array(kebab).max(8).default([]),
  /** Questions answered by the article: rendered at the end and marked up as FAQPage. */
  faq: z.array(faqItem).max(10).default([]),
});
export type BlogPost = z.infer<typeof blogPost>;

export const blogConfig = z.object({
  /** URL segment of the blog; a page with this slug in the menu opens the blog index. */
  slug: kebab.default("blog"),
  title: shortText(80),
  intro: optionalText(400),
  /** Photo behind the blog index header. */
  cover: imageRef.optional(),
  categories: z
    .array(z.object({ slug: kebab, name: shortText(60), description: optionalText(300) }))
    .min(1)
    .max(20),
  /**
   * "articles": landscape covers and reading time. "videos": a video series (episodes) with portrait covers,
   * the video at the top of each post and the words of the blog changed to episodes.
   */
  format: z.enum(["articles", "videos"]).default("articles"),
  /** Optional second way to browse (e.g. the characters of a series): each tag lists its posts at /<blog>/<tagsPath>/<tag>. */
  tags: z
    .array(z.object({ slug: kebab, name: shortText(60), description: optionalText(300), image: imageRef.optional() }))
    .max(30)
    .default([]),
  /** What the tags are called, e.g. "Personagens"; also the URL segment's label. */
  tagsLabel: optionalText(40),
  tagsPath: kebab.default("tag"),
  /** The box beside every post (default: talk to the business), e.g. "Receba o episódio novo" with a button to the sign-up. */
  postCta: z.object({ title: shortText(120), text: optionalText(300), cta }).optional(),
});
export type BlogConfig = z.infer<typeof blogConfig>;

/** Today in Brazil (YYYY-MM-DD): a post dated today goes live at midnight in São Paulo, not in UTC. */
export function todayInBrazil(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Posts visitors may see: published and not dated in the future (a future date schedules the post). */
export function publishedPosts(posts: BlogPost[], today = todayInBrazil()): BlogPost[] {
  return posts.filter((p) => p.status === "published" && p.publishedAt <= today);
}

/** Validates posts against the site's blog settings (categories must exist, slugs unique), newest first. */
export function parseBlogPosts(input: unknown, config: Pick<BlogConfig, "categories"> & { tags?: BlogConfig["tags"] }): BlogPost[] {
  const posts = z.array(blogPost).max(2000).parse(input);
  const categories = new Set(config.categories.map((c) => c.slug));
  const tags = new Set((config.tags ?? []).map((t) => t.slug));
  const seen = new Set<string>();
  for (const p of posts) {
    if (!categories.has(p.category)) throw new Error(`Categoria inexistente no artigo "${p.slug}": ${p.category}`);
    if (seen.has(p.slug)) throw new Error(`Artigo duplicado: ${p.slug}`);
    const missingTag = p.tags.find((t) => !tags.has(t));
    if (missingTag) throw new Error(`Tag inexistente no artigo "${p.slug}": ${missingTag}`);
    seen.add(p.slug);
  }
  // Same day (several episodes launched together): the higher episode number first.
  return [...posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || (b.episode ?? 0) - (a.episode ?? 0));
}

/** Every problem in a list of posts, with the path of the field at fault (for the editor's messages). */
export function blogPostIssues(input: unknown, config: Pick<BlogConfig, "categories"> & { tags?: BlogConfig["tags"] }): { path: (string | number)[]; message: string }[] {
  const parsed = z.array(blogPost).max(2000).safeParse(input);
  if (!parsed.success) return parsed.error.issues.map((i) => ({ path: i.path as (string | number)[], message: i.message }));
  const categories = new Set(config.categories.map((c) => c.slug));
  const seen = new Set<string>();
  const issues: { path: (string | number)[]; message: string }[] = [];
  parsed.data.forEach((p, i) => {
    if (!categories.has(p.category)) issues.push({ path: [i, "category"], message: "Escolha uma categoria que exista no blog" });
    p.tags.forEach((t, j) => {
      if (!(config.tags ?? []).some((x) => x.slug === t)) issues.push({ path: [i, "tags", j], message: `A tag "${t}" não existe no blog` });
    });
    if (seen.has(p.slug)) issues.push({ path: [i, "slug"], message: `Já existe um artigo com o endereço "${p.slug}"` });
    seen.add(p.slug);
  });
  return issues;
}

/** Rough reading time in minutes (200 words per minute, at least 1). */
export function readingMinutes(post: BlogPost): number {
  const words = post.body
    .map((b) => ("text" in b ? b.text : "items" in b ? b.items.join(" ") : b.type === "table" ? b.rows.flat().map((c) => c.text).join(" ") : (b.caption ?? "")))
    .join(" ")
    .split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}
