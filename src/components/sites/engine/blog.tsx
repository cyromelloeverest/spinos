import type { ReactNode } from "react";
import { localHref, ui } from "./i18n";
import type { BlogBlock, BlogPost, ImageRef, Section } from "@/lib/sites/content";
import { readingMinutes } from "@/lib/sites/content";
import { type RenderContext, anchorId, ctaHref, formatDate, resolveImage, whatsappUrl } from "./context";
import { Icon, WhatsAppGlyph } from "./icons";
import { POSTS_PER_PAGE, blogPageCount } from "./route";
import { Container, Eyebrow, Highlighted, Picture, SectionShell, SectionTitle, VideoFrame, Visual, emphasisClass, headingWeight, toneOf } from "./ui";

/* ---------- Page header (inner pages and blog) ---------- */

export function Breadcrumbs({ items, label = "Você está em" }: { items: { label: string; href: string }[]; label?: string }) {
  if (items.length < 2) return null;
  return (
    <nav aria-label={label} className="mb-6 text-xs font-medium uppercase tracking-[0.16em] text-muted">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, i) => (
          <li key={item.href} className="flex min-w-0 items-center gap-2">
            {i > 0 && <span aria-hidden>/</span>}
            {i === items.length - 1 ? (
              <span aria-current="page" className="max-w-[16rem] truncate text-ink sm:max-w-md">
                {item.label}
              </span>
            ) : (
              <a href={item.href} className="hover:text-ink">
                {item.label}
              </a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Compact dark header for inner pages: breadcrumbs, title, intro and an optional drifting photo. */
export function PageHeader({
  ctx,
  id,
  eyebrow,
  title,
  highlight,
  intro,
  image,
  meta,
  aside,
  logo,
}: {
  ctx: RenderContext;
  id?: string;
  eyebrow?: string;
  title: string;
  highlight?: string;
  intro?: string;
  image?: ImageRef;
  meta?: ReactNode;
  /** Shown beside the text on wide screens and below it on phones, e.g. an article's cover. */
  aside?: ReactNode;
  /** Sub-brand logo above the title (white version for the dark header). */
  logo?: ImageRef;
}) {
  const photo = resolveImage(ctx, image);
  return (
    <section id={id} className="hero-immersive page-header tone-dark relative isolate overflow-hidden">
      {photo ? (
        <div aria-hidden className="absolute inset-0 -z-20 overflow-hidden">
          <div className="hero-depth h-full w-full">
            <Picture image={{ ...photo, alt: "" }} sizes="100vw" priority className="ken-burns h-full w-full object-cover object-[50%_25%]" />
          </div>
        </div>
      ) : (
        <div aria-hidden className="brand-pattern absolute inset-0 -z-20" />
      )}
      <div
        aria-hidden
        className={`absolute inset-0 -z-10 ${photo ? "bg-[linear-gradient(90deg,color-mix(in_srgb,var(--dark)_90%,transparent),color-mix(in_srgb,var(--dark)_45%,transparent)),linear-gradient(0deg,color-mix(in_srgb,var(--dark)_60%,transparent),transparent_50%)]" : "bg-[linear-gradient(90deg,color-mix(in_srgb,var(--dark)_92%,transparent),color-mix(in_srgb,var(--dark)_60%,transparent))]"}`}
      />
      <Container className={`pt-40 pb-20 sm:pt-44 sm:pb-24 ${aside ? "grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]" : ""}`}>
        <div className="reveal max-w-3xl">
          <Breadcrumbs items={ctx.breadcrumbs ?? []} label={ui(ctx).youAreIn} />
          {(() => {
            const mark = resolveImage(ctx, logo);
            return mark ? <Picture image={{ ...mark, alt: mark.alt || title }} sizes="240px" className="mb-6 h-14 w-auto max-w-[16rem] object-contain object-left" /> : null;
          })()}
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className={`font-heading text-4xl leading-[1.1] tracking-tight text-balance sm:text-5xl ${aside ? "xl:text-[3.4rem]" : "lg:text-6xl"} ${headingWeight(ctx)}`}>
            <Highlighted ctx={ctx} text={title} highlight={highlight} />
          </h1>
          {intro && <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted text-pretty whitespace-pre-line">{intro}</p>}
          {meta}
        </div>
        {aside}
      </Container>
    </section>
  );
}

/* ---------- Cards and listings ---------- */

/** Where the site's contact form lives (a page with a contact section), so CTAs never point at a dead anchor. */
export function contactHref(ctx: RenderContext): string {
  for (const page of ctx.site.pages) {
    const contact = page.sections.find((s) => s.type === "contact" && !s.hidden);
    if (contact) return localHref(ctx, `${page.slug === "" ? "/" : `/${page.slug}`}#${contact.id}`);
  }
  return localHref(ctx, "/");
}

function categoryName(ctx: RenderContext, slug: string): string {
  return ctx.site.blog?.categories.find((c) => c.slug === slug)?.name ?? slug;
}

function blogPath(ctx: RenderContext, post?: BlogPost): string {
  const base = `/${ctx.site.blog?.slug ?? "blog"}`;
  return post ? `${base}/${post.slug}` : base;
}

/** A "videos" blog (a video series): portrait covers, episodes instead of articles. */
function isVideos(ctx: RenderContext): boolean {
  return ctx.site.blog?.format === "videos";
}

function tagName(ctx: RenderContext, slug: string): string {
  return ctx.site.blog?.tags.find((t) => t.slug === slug)?.name ?? slug;
}

function tagPath(ctx: RenderContext, slug: string): string {
  return `${blogPath(ctx)}/${ctx.site.blog?.tagsPath ?? "tag"}/${slug}`;
}

/** Episode card: the portrait cover (Shorts/Reels art) whole, a play mark, the number and the title. */
function EpisodeCard({ ctx, post }: { ctx: RenderContext; post: BlogPost }) {
  const cover = resolveImage(ctx, post.cover);
  return (
    <a href={blogPath(ctx, post)} className="group flex h-full flex-col">
      <div className="episode-cover relative aspect-[9/16] overflow-hidden rounded-[var(--brand-radius)] bg-[var(--line)] shadow-lg">
        {cover ? (
          <Picture image={{ ...cover, alt: cover.alt || post.title }} sizes="(min-width: 1024px) 22vw, (min-width: 640px) 33vw, 50vw" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
        ) : (
          <div className="tone-dark brand-pattern h-full w-full" />
        )}
        {post.video && (
          <span aria-hidden className="absolute right-3 bottom-3 flex size-11 items-center justify-center rounded-full bg-black/55 text-white transition group-hover:scale-110 group-hover:bg-brand">
            <svg viewBox="0 0 24 24" className="ml-0.5 size-5" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z" /></svg>
          </span>
        )}
        {post.badge && <span className="episode-badge absolute top-3 left-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#16181d] shadow">{post.badge}</span>}
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-brand-text">
        {/* With a badge (the lesson's subject, on the cover), the line keeps only the episode number. */}
        {post.badge ? (post.episode ? `Ep. ${post.episode}` : post.badge) : `${post.episode ? `Ep. ${post.episode} · ` : ""}${categoryName(ctx, post.category)}`}
      </p>
      <h3 className="mt-1 font-heading text-lg leading-snug text-balance transition group-hover:text-brand-text">{post.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{post.excerpt}</p>
    </a>
  );
}

const postsGrid = (ctx: RenderContext) => (isVideos(ctx) ? "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4" : "grid gap-6 md:grid-cols-2 lg:grid-cols-3");

export function PostCard({ ctx, post }: { ctx: RenderContext; post: BlogPost }) {
  if (isVideos(ctx)) return <EpisodeCard ctx={ctx} post={post} />;
  const cover = resolveImage(ctx, post.cover);
  return (
    <a href={blogPath(ctx, post)} className="post-card group card-surface flex h-full flex-col overflow-hidden rounded-[var(--brand-radius)] border border-[var(--line)] transition duration-300 hover:-translate-y-1 hover:shadow-2xl">
      <div className="overflow-hidden">
        {cover ? (
          <Visual image={cover} sizes="(min-width: 1024px) 33vw, 100vw" motion={false} className="aspect-[16/9] w-full transition duration-700 group-hover:scale-105" />
        ) : (
          <TypeCover ctx={ctx} label={categoryName(ctx, post.category)} />
        )}
      </div>
      <div className="flex flex-1 flex-col p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-text">{categoryName(ctx, post.category)}</p>
        <h3 className="mt-3 text-xl font-semibold leading-snug text-balance">{post.title}</h3>
        <p className="mt-3 flex-1 leading-relaxed text-muted">{post.excerpt}</p>
        <p className="mt-6 flex items-center gap-2 text-sm text-muted">
          <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
          <span aria-hidden>·</span>
          {readingMinutes(post)} min de leitura
        </p>
      </div>
    </a>
  );
}

/** Cover drawn from type when an article has no photo: the category in large letters, never an empty box. */
function TypeCover({ ctx, label }: { ctx: RenderContext; label: string }) {
  return (
    <div className="type-cover tone-dark brand-pattern relative flex aspect-[16/9] w-full flex-col justify-between p-6 transition duration-700 group-hover:scale-105">
      <span className="font-heading text-sm font-extrabold tracking-tight text-white/80">
        {ctx.site.business.name}
        <span className="text-[var(--brand-bright)]">.</span>
      </span>
      <span className={`font-heading text-3xl leading-tight tracking-tight text-white text-balance ${emphasisClass(ctx)}`}>{label}</span>
    </div>
  );
}

/** Terms, policies and other long texts, set like an article. */
export function DocumentSection({ section, ctx }: { section: Extract<Section, { type: "document" }>; ctx: RenderContext }) {
  return (
    <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage}>
      <Container className={section.wide ? "" : "max-w-3xl"}>
        <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} center={section.align === "center"} className="mb-6" />
        <div className={`document-body ${section.align === "center" && !section.wide ? "mx-auto max-w-2xl" : ""}`}>
          {section.body.map((block, i) => (
            <Block key={i} block={block} ctx={ctx} />
          ))}
        </div>
        {section.updatedAt && <p className="mt-14 border-t border-[var(--line)] pt-6 text-sm text-muted">{section.updatedAt}</p>}
      </Container>
    </SectionShell>
  );
}

/** Home-page teaser: latest posts. */
export function PostsSection({ section, ctx }: { section: Extract<Section, { type: "posts" }>; ctx: RenderContext }) {
  const all = ctx.posts ?? [];
  const picked = section.slugs.length
    ? section.slugs.map((slug) => all.find((p) => p.slug === slug)).filter((p): p is BlogPost => Boolean(p))
    : all.filter((p) => (!section.category || p.category === section.category) && (!section.tag || p.tags.includes(section.tag)));
  const posts = picked.slice(0, section.count);
  if (posts.length === 0) return null;
  const link = section.linkLabel === "" ? null : (section.linkLabel ?? "Ver todos");
  const head = (
    <div className="mb-12 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
      <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} className="" />
      {link && (
        <a href={section.tag ? tagPath(ctx, section.tag) : blogPath(ctx)} className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-brand-text">
          {link} <Icon name="arrowRight" className="size-4" />
        </a>
      )}
    </div>
  );

  if (section.variant === "featured") {
    const [first, ...rest] = posts;
    const cover = resolveImage(ctx, first!.cover);
    return (
      <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage}>
        <Container>
          {head}
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-14">
            <div className="mx-auto w-full max-w-[22rem]">
              {first!.video ? (
                <VideoFrame url={first!.video} vertical poster={cover} title={first!.title} />
              ) : (
                <EpisodeCard ctx={ctx} post={first!} />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-text">
                {first!.episode ? `Ep. ${first!.episode} · ` : ""}
                {categoryName(ctx, first!.category)}
              </p>
              <h3 className={`mt-2 font-heading text-3xl leading-tight text-balance sm:text-4xl ${headingWeight(ctx)}`}>
                <a href={blogPath(ctx, first)} className="hover:text-brand-text">{first!.title}</a>
              </h3>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">{first!.excerpt}</p>
              <a href={blogPath(ctx, first)} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-[var(--button-radius)] bg-brand px-6 text-sm font-semibold uppercase tracking-[0.12em] text-brand-contrast hover:brightness-110">
                {isVideos(ctx) ? "Ver a lição do episódio" : "Ler o artigo"} <Icon name="arrowRight" className="size-4" />
              </a>
              {rest.length > 0 && (
                <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
                  {rest.map((p) => (
                    <li key={p.slug} className="reveal">
                      <PostCard ctx={ctx} post={p} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Container>
      </SectionShell>
    );
  }

  return (
    <SectionShell id={section.id} tone={toneOf(section, "muted")} ctx={ctx} backdrop={section.backgroundImage}>
      <Container>
        {head}
        {section.variant === "list" ? (
          // An index of publications, as in a law firm's or a consultancy's insights page: date and area, title, summary.
          <ol className="post-index divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {posts.map((p) => (
              <li key={p.slug} className="reveal">
                <a href={blogPath(ctx, p)} className="group grid gap-3 py-8 sm:grid-cols-[11rem_1fr_auto] sm:gap-10">
                  <p className="text-sm text-muted">
                    <time dateTime={p.publishedAt}>{formatDate(p.publishedAt)}</time>
                    <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.16em] text-brand-text">{categoryName(ctx, p.category)}</span>
                  </p>
                  <div>
                    <h3 className="font-heading text-2xl leading-snug text-balance transition group-hover:text-brand-text">{p.title}</h3>
                    <p className="mt-3 line-clamp-2 max-w-3xl leading-relaxed text-muted">{p.excerpt}</p>
                  </div>
                  <Icon name="arrowRight" className="hidden size-5 self-center text-brand-text transition group-hover:translate-x-1 sm:block" />
                </a>
              </li>
            ))}
          </ol>
        ) : (
          <ul className={postsGrid(ctx)}>
            {posts.map((p) => (
              <li key={p.slug} className="reveal">
                <PostCard ctx={ctx} post={p} />
              </li>
            ))}
          </ul>
        )}
      </Container>
    </SectionShell>
  );
}

export function BlogIndexView({ ctx, category, tag, page = 1 }: { ctx: RenderContext; category?: string; tag?: string; page?: number }) {
  const blog = ctx.site.blog!;
  const matching = blogListing(ctx.posts ?? [], category, tag);
  const pages = blogPageCount(matching.length);
  const posts = matching.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);
  const listing = tag ? tagPath(ctx, tag) : category ? `${blogPath(ctx)}/categoria/${category}` : blogPath(ctx);
  const used = new Set((ctx.posts ?? []).map((p) => p.category));
  const usedTags = new Set((ctx.posts ?? []).flatMap((p) => p.tags));
  const current = blog.categories.find((c) => c.slug === category);
  const currentTag = blog.tags.find((t) => t.slug === tag);
  const videos = isVideos(ctx);
  const header = currentTag ?? current;
  return (
    <>
      <PageHeader
        ctx={ctx}
        eyebrow={currentTag ? (blog.tagsLabel ?? "Tag") : current ? (videos ? "Série" : "Categoria") : videos ? "Episódios" : "Conteúdo"}
        title={header?.name ?? blog.title}
        intro={header?.description ?? blog.intro}
        image={blog.cover}
      />
      <section className="tone-light py-20">
        <Container>
          <nav aria-label={videos ? "Séries" : "Categorias"} className="mb-6 flex flex-wrap gap-3">
            <CategoryChip href={blogPath(ctx)} active={!category && !tag} label="Todos" />
            {blog.categories
              .filter((c) => used.has(c.slug))
              .map((c) => (
                <CategoryChip key={c.slug} href={`${blogPath(ctx)}/categoria/${c.slug}`} active={c.slug === category} label={c.name} />
              ))}
          </nav>
          {blog.tags.some((t) => usedTags.has(t.slug)) && (
            <nav aria-label={blog.tagsLabel ?? "Tags"} className="mb-12 flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-muted">{blog.tagsLabel ?? "Tags"}:</span>
              {blog.tags
                .filter((t) => usedTags.has(t.slug))
                .map((t) => (
                  <CategoryChip key={t.slug} href={tagPath(ctx, t.slug)} active={t.slug === tag} label={t.name} />
                ))}
            </nav>
          )}
          {posts.length === 0 ? (
            <p className="text-lg text-muted">{videos ? "Nenhum episódio publicado aqui ainda." : "Nenhum artigo publicado nesta categoria ainda."}</p>
          ) : (
            <ul className={postsGrid(ctx)}>
              {posts.map((p) => (
                <li key={p.slug} className="reveal">
                  <PostCard ctx={ctx} post={p} />
                </li>
              ))}
            </ul>
          )}
          {pages > 1 && <Pagination listing={listing} page={page} pages={pages} />}
        </Container>
      </section>
    </>
  );
}

/** The posts a listing shows, in the order they come (newest first): all, one category or one tag. */
export function blogListing(posts: BlogPost[], category?: string, tag?: string): BlogPost[] {
  return posts.filter((p) => (!category || p.category === category) && (!tag || p.tags.includes(tag)));
}

function Pagination({ listing, page, pages }: { listing: string; page: number; pages: number }) {
  const href = (n: number) => (n === 1 ? listing : `${listing}/pagina/${n}`);
  const link = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--button-radius)] border border-[var(--line)] px-4 text-sm font-semibold transition hover:border-brand hover:text-brand";
  return (
    <nav aria-label="Paginação" className="mt-14 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && <a href={href(page - 1)} rel="prev" className={link}>← Anterior</a>}
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) =>
        n === page ? (
          <span key={n} aria-current="page" className={`${link} border-brand bg-brand text-white hover:text-white`}>{n}</span>
        ) : (
          <a key={n} href={href(n)} className={link}>{n}</a>
        ),
      )}
      {page < pages && <a href={href(page + 1)} rel="next" className={link}>Próxima →</a>}
    </nav>
  );
}

function CategoryChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full border px-5 py-2.5 text-sm font-semibold transition ${active ? "border-brand bg-brand text-brand-contrast" : "border-[var(--line)] hover:border-brand hover:text-brand-text"}`}
    >
      {label}
    </a>
  );
}

/* ---------- Article ---------- */

/** An article's text with **bold** and [links](https://...): the only marks imported articles need. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*.+?\*\*|\[[^\]]+\]\((?:https:\/\/|\/)[^)\s]*\))/g);
  return parts.map((part, i) => {
    const bold = part.match(/^\*\*(.+)\*\*$/);
    if (bold) return <strong key={i}>{bold[1]}</strong>;
    const link = part.match(/^\[([^\]]+)\]\((.+)\)$/);
    if (!link) return part;
    const external = link[2]!.startsWith("https://");
    return (
      <a key={i} href={link[2]} className="text-brand-text underline underline-offset-2" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {link[1]}
      </a>
    );
  });
}

function Block({ block, ctx }: { block: BlogBlock; ctx: RenderContext }) {
  switch (block.type) {
    case "images": {
      const photos = block.images.flatMap((ref) => {
        const p = resolveImage(ctx, ref);
        return p ? [p] : [];
      });
      if (photos.length === 0) return null;
      // One photo spans the column; two side by side; three or more in a grid whose first photo leads.
      const grid = photos.length === 1 ? "" : photos.length === 2 ? "grid gap-3 sm:grid-cols-2" : "grid grid-cols-2 gap-3 sm:grid-cols-3 [&>*:first-child]:col-span-2 [&>*:first-child]:row-span-2";
      return (
        <figure className={`mt-10 ${block.size === "medium" ? "mx-auto w-full max-w-lg" : ""}`}>
          <div className={grid}>
            {photos.map((p, i) => (
              <Picture
                key={i}
                image={p}
                sizes={photos.length === 1 ? "(min-width: 1024px) 48rem, 100vw" : "(min-width: 1024px) 24rem, 50vw"}
                className={`w-full rounded-[var(--brand-radius)] object-cover ${photos.length === 1 ? "h-auto" : "aspect-[4/3] h-full"}`}
              />
            ))}
          </div>
          {block.caption && <figcaption className="mt-3 text-sm text-muted">{block.caption}</figcaption>}
        </figure>
      );
    }
    case "table": {
      const [head, ...rows] = block.rows;
      return (
        <div className="mt-8 overflow-x-auto">
          <table className="spec-table w-full border-collapse text-sm">
            <thead>
              <tr>
                {head!.map((c, i) => (
                  <th key={i} colSpan={c.span} className="whitespace-pre-line">{c.text}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {row.map((c, i) => (
                    <td key={i} colSpan={c.span} className="whitespace-pre-line">{c.text}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "p":
      return <p className="mt-6 text-lg leading-8 text-pretty"><RichText text={block.text} /></p>;
    case "h2":
      return (
        <h2 id={anchorId(block.text)} className="article-h2 mt-14 scroll-mt-28 text-3xl font-semibold leading-tight tracking-tight text-balance">
          {block.text}
        </h2>
      );
    case "h3":
      return (
        <h3 id={anchorId(block.text)} className="article-h3 mt-10 scroll-mt-28 text-2xl font-semibold leading-snug text-balance">
          {block.text}
        </h3>
      );
    case "ul":
    case "ol": {
      const List = block.type;
      return (
        <List className={`mt-6 space-y-3 pl-6 text-lg leading-8 ${block.type === "ul" ? "list-disc" : "list-decimal"} marker:text-brand-text`}>
          {block.items.map((item, i) => (
            <li key={i}><RichText text={item} /></li>
          ))}
        </List>
      );
    }
    case "quote":
      return (
        <blockquote className="mt-10 border-l-4 border-brand pl-6 text-xl leading-relaxed italic">
          {block.text}
          {block.cite && <footer className="mt-3 text-sm not-italic text-muted">{block.cite}</footer>}
        </blockquote>
      );
  }
}

export function BlogPostView({ ctx, post }: { ctx: RenderContext; post: BlogPost }) {
  const cover = resolveImage(ctx, post.cover);
  const headings = post.body.filter((b): b is Extract<BlogBlock, { type: "h2" | "h3" }> => b.type === "h2" || b.type === "h3");
  const related = (ctx.posts ?? []).filter((p) => p.slug !== post.slug && p.category === post.category).slice(0, 3);
  // A series continues: the next episodes first, then the earlier ones.
  const byEpisode = [...(ctx.posts ?? [])].filter((p) => p.slug !== post.slug && p.episode).sort((a, b) => a.episode! - b.episode!);
  const nextEpisodes = post.episode ? [...byEpisode.filter((p) => p.episode! > post.episode!), ...byEpisode.filter((p) => p.episode! < post.episode!).reverse()].slice(0, 4) : [];
  const more = nextEpisodes.length > 0 ? nextEpisodes : related.length > 0 ? related : (ctx.posts ?? []).filter((p) => p.slug !== post.slug).slice(0, 3);
  const videos = isVideos(ctx);
  const meta = (
    <>
      <p className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        {post.episode && <span className="font-semibold text-brand-text">Ep. {post.episode}</span>}
        {post.episode && <span aria-hidden>·</span>}
        {post.author && <span>{post.author}</span>}
        {post.author && <span aria-hidden>·</span>}
        <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
        {!videos && <span aria-hidden>·</span>}
        {!videos && <span>{readingMinutes(post)} min de leitura</span>}
      </p>
      {post.tags.length > 0 && (
        <p className="mt-4 flex flex-wrap gap-2">
          {post.tags.map((t) => (
            <a key={t} href={tagPath(ctx, t)} className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold hover:border-brand hover:text-brand-text">
              {tagName(ctx, t)}
            </a>
          ))}
        </p>
      )}
    </>
  );

  return (
    <article>
      <div aria-hidden className="read-progress fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-brand" />
      <PageHeader
        ctx={ctx}
        eyebrow={post.badge ?? categoryName(ctx, post.category)}
        title={post.title}
        intro={post.excerpt}
        meta={meta}
        aside={
          post.video ? (
            <div className="reveal mx-auto w-full max-w-[22rem]">
              <VideoFrame url={post.video} vertical={videos} poster={cover} title={post.title} />
            </div>
          ) : (
            cover && (
            <div className="reveal relative">
              <div aria-hidden className="absolute -right-3 -bottom-3 left-6 top-6 rounded-[var(--brand-radius)] bg-brand/80" />
              <Picture
                image={{ ...cover, alt: cover.alt || post.title }}
                sizes="(min-width: 1024px) 40vw, 100vw"
                priority
                // At its own proportions: covers are often social-media art with text near the edges.
                className="relative w-full rounded-[var(--brand-radius)] object-cover shadow-2xl"
                style={{ aspectRatio: `${cover.width} / ${cover.height}` }}
              />
            </div>
            )
          )
        }
      />
      <div className="tone-light py-16 sm:py-20">
        <Container className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 max-w-3xl">
            <div className="[&>*:first-child]:mt-0">
              {post.body.map((b, i) => (
                <Block key={i} block={b} ctx={ctx} />
              ))}
            </div>
            {post.faq.length > 0 && (
              <section aria-labelledby="perguntas" className="mt-16 border-t border-[var(--line)] pt-12">
                <h2 id="perguntas" className="text-3xl font-semibold tracking-tight">
                  Perguntas frequentes
                </h2>
                {post.faq.map((f) => (
                  <details key={f.question} className="group border-b border-[var(--line)] py-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-semibold">
                      {f.question}
                      <span aria-hidden className="text-brand-text transition group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-3 leading-relaxed text-muted whitespace-pre-line">{f.answer}</p>
                  </details>
                ))}
              </section>
            )}
          </div>
          <aside className="space-y-8 lg:sticky lg:top-28 lg:self-start">
            {headings.length >= 3 && (
              <nav aria-label="Neste artigo" className="rounded-[var(--brand-radius)] border border-[var(--line)] p-6">
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-brand-text">Neste artigo</p>
                <ol className="space-y-2.5 text-sm">
                  {headings.map((h) => (
                    <li key={h.text} className={h.type === "h3" ? "pl-3" : ""}>
                      <a href={`#${anchorId(h.text)}`} className="text-muted hover:text-ink">
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            {ctx.site.blog?.postCta ? (
              <div className="tone-dark rounded-[var(--brand-radius)] p-7">
                <p className="text-lg font-semibold leading-snug">{ctx.site.blog.postCta.title}</p>
                {ctx.site.blog.postCta.text && <p className="mt-3 text-sm leading-relaxed text-muted">{ctx.site.blog.postCta.text}</p>}
                <a href={ctaHref(ctx, ctx.site.blog.postCta.cta)} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-[var(--button-radius)] bg-brand px-5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-contrast">
                  {ctx.site.blog.postCta.cta.label} <Icon name="arrowRight" className="size-4" />
                </a>
              </div>
            ) : (
            <div className="tone-dark rounded-[var(--brand-radius)] p-7">
              <p className="text-lg font-semibold leading-snug">{ui(ctx).articleCtaTitle}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">{ui(ctx).articleCtaText}</p>
              <a href={contactHref(ctx)} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-[var(--button-radius)] bg-brand px-5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-contrast">
                {ctx.site.theme.headerCta?.label ?? ui(ctx).talkToUs} <Icon name="arrowRight" className="size-4" />
              </a>
              {ctx.site.business.whatsapp && (
                <a
                  href={whatsappUrl(ctx.site.business.whatsapp.number, ctx.site.business.whatsapp.defaultMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-[var(--button-radius)] border border-white/20 px-5 text-xs font-semibold uppercase tracking-[0.14em] hover:bg-white/10"
                >
                  <WhatsAppGlyph className="size-4" /> WhatsApp
                </a>
              )}
            </div>
            )}
          </aside>
        </Container>
      </div>
      {more.length > 0 && (
        <section className="tone-muted py-20">
          <Container>
            <h2 className={`mb-12 font-heading text-3xl tracking-tight sm:text-4xl ${headingWeight(ctx)}`}>
              {videos ? "Assista" : "Continue"} <span className={emphasisClass(ctx)}>{videos ? "também" : "lendo"}</span>
            </h2>
            <ul className={postsGrid(ctx)}>
              {more.map((p) => (
                <li key={p.slug}>
                  <PostCard ctx={ctx} post={p} />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}
    </article>
  );
}
