import type { Section } from "@/lib/sites/content";
import type { RenderContext } from "../context";
import { Icon, SocialIcon } from "../icons";
import { ui } from "../i18n";
import { Container, SectionShell, SectionTitle, toneOf } from "../ui";

type Of<T extends Section["type"]> = Extract<Section, { type: T }>;

/**
 * The latest posts of the account connected in the panel. Images are our own
 * copies (Instagram's links expire), shown square like the profile grid; each
 * tile opens the post on Instagram. With nothing to show, the block is left out.
 */
export function InstagramSection({ section, ctx }: { section: Of<"instagram">; ctx: RenderContext }) {
  const feed = ctx.instagram;
  const posts = feed?.posts.slice(0, section.count) ?? [];
  if (!feed || posts.length === 0) return null;
  const t = ui(ctx);
  const profile = `https://www.instagram.com/${feed.username}/`;
  const strip = section.variant === "strip";
  return (
    <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage}>
      <Container>
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <SectionTitle ctx={ctx} eyebrow={section.eyebrow ?? `@${feed.username}`} title={section.heading} highlight={section.highlight} intro={section.intro} className="" />
          <a
            href={profile}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center gap-3 rounded-[var(--button-radius)] border border-[var(--line)] px-6 text-sm font-semibold uppercase tracking-[0.12em] transition hover:border-current"
          >
            <SocialIcon name="instagram" className="size-5" />
            {section.followLabel || `${t.follow} @${feed.username}`}
          </a>
        </div>
        <ul className={strip ? "instagram-strip -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8" : "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4"}>
          {posts.map((post) => (
            <li key={post.id} className={strip ? "w-[68%] shrink-0 snap-start sm:w-[34%] lg:w-[23%]" : ""}>
              <a
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${t.instagramPost}: ${post.caption.slice(0, 120) || `@${feed.username}`}`}
                className="group relative block aspect-square overflow-hidden rounded-[calc(var(--brand-radius)*0.6)] bg-[var(--line)]"
              >
                <img
                  src={post.image.src}
                  width={post.image.width}
                  height={post.image.height}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
                {post.mediaType !== "IMAGE" && (
                  <span aria-hidden className="absolute top-2.5 right-2.5 flex size-8 items-center justify-center rounded-full bg-black/45 text-white">
                    <Icon name={post.mediaType === "VIDEO" ? "play" : "layers"} className="size-4" />
                  </span>
                )}
                <span aria-hidden className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-black/0 p-4 text-sm leading-snug text-white opacity-0 transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                  <span className="line-clamp-3">{post.caption}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </SectionShell>
  );
}
