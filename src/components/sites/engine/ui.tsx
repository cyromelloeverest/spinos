import { VideoFacade } from "./sections/video-facade";
import type { CSSProperties } from "react";
import { preload } from "react-dom";
import type { ReactNode } from "react";
import type { Cta, ImageRef } from "@/lib/sites/content";
import { type RenderContext, type ResolvedImage, ctaHref, isExternal, resolveImage } from "./context";
import { Icon, WhatsAppGlyph } from "./icons";

export type Tone = "light" | "muted" | "dark" | "brand";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-7xl px-5 sm:px-8 ${className}`}>{children}</div>;
}

/** Resolves a section's tone: an explicit choice wins over the section type's default. */
export function toneOf(section: { tone: "auto" | Tone }, fallback: Tone): Tone {
  return section.tone === "auto" ? fallback : section.tone;
}

/**
 * A section band. With a background photo the band is always dark, the photo
 * drifts with the scroll (parallax) and cards inside turn into frosted glass.
 */
export function SectionShell({
  id,
  tone,
  ctx,
  backdrop,
  children,
  className = "",
}: {
  id: string;
  tone: Tone;
  ctx: RenderContext;
  backdrop?: ImageRef;
  children: ReactNode;
  className?: string;
}) {
  const image = resolveImage(ctx, backdrop);
  if (!image) {
    return (
      <section id={id} className={`tone-${tone} relative scroll-mt-24 py-[var(--section-py)] ${className}`}>
        {children}
      </section>
    );
  }
  return (
    <section id={id} className={`tone-dark has-backdrop relative isolate scroll-mt-24 overflow-hidden py-[var(--section-py)] ${className}`}>
      <div aria-hidden className="absolute inset-0 -z-20 overflow-hidden">
        <Picture image={{ ...image, alt: "" }} sizes="100vw" className="parallax h-full w-full object-cover" />
      </div>
      <div aria-hidden className="backdrop-shade absolute inset-0 -z-10 bg-[color-mix(in_srgb,var(--dark)_80%,transparent)]" />
      {children}
    </section>
  );
}

/** h1 for the section that opens a page without a hero, h2 everywhere else. */
export function headingTag(ctx: RenderContext): "h1" | "h2" {
  return ctx.primaryHeading ? "h1" : "h2";
}

/** Base weight of headings: light when emphasis comes from weight, semibold when it comes from color. */
export function headingWeight(ctx: RenderContext): string {
  const style = ctx.site.theme.headlineStyle;
  return style === "weight" ? "font-light" : style === "underline" ? "font-medium" : style === "italic" ? "font-normal" : "font-semibold";
}

/** Classes for the highlighted words of a heading, per the theme's headline style. */
export function emphasisClass(ctx: RenderContext): string {
  switch (ctx.site.theme.headlineStyle) {
    case "weight":
      return "font-bold";
    case "plain":
      return "";
    case "marker":
      // A block of the brand color behind the words, wrapping line by line.
      return "headline-marker";
    case "outline":
      // Hollow letters: for monochrome brands, where a colored highlight would vanish.
      return "headline-outline";
    case "italic":
      return "italic";
    case "underline":
      return "font-extrabold underline decoration-[var(--brand-primary)] decoration-[0.08em] underline-offset-[0.16em] [text-decoration-skip-ink:none]";
    default:
      return "text-brand-text";
  }
}

/** Heading text with its highlighted fragment emphasized according to the theme. */
export function Highlighted({ ctx, text, highlight }: { ctx: RenderContext; text: string; highlight?: string }) {
  if (!highlight || !text.includes(highlight)) return <>{text}</>;
  const [before, ...rest] = text.split(highlight);
  const emphasis = emphasisClass(ctx);
  return (
    <>
      {before}
      <span className={emphasis}>{highlight}</span>
      {rest.join(highlight)}
    </>
  );
}

export function Eyebrow({ children, center = false }: { children?: ReactNode; center?: boolean }) {
  if (!children) return null;
  return (
    <p className={`eyebrow mb-5 text-xs font-semibold uppercase tracking-[0.24em] text-brand-text ${center ? "text-center" : ""}`}>{children}</p>
  );
}

export function SectionTitle({
  ctx,
  eyebrow,
  title,
  highlight,
  intro,
  center = false,
  className = "mb-14",
}: {
  ctx: RenderContext;
  eyebrow?: string;
  title?: string;
  highlight?: string;
  intro?: string;
  center?: boolean;
  className?: string;
}) {
  if (!title && !intro && !eyebrow) return null;
  const Heading = headingTag(ctx);
  return (
    <div className={`max-w-3xl ${center ? "mx-auto text-center" : ""} ${className}`}>
      <Eyebrow center={center}>{eyebrow}</Eyebrow>
      {title && (
        <Heading className={`font-heading text-4xl leading-[1.1] tracking-tight text-balance sm:text-5xl ${headingWeight(ctx)}`}>
          <Highlighted ctx={ctx} text={title} highlight={highlight} />
        </Heading>
      )}
      {intro && <p className="mt-6 text-lg leading-relaxed text-muted text-pretty whitespace-pre-line">{intro}</p>}
    </div>
  );
}

export function CtaButton({
  ctx,
  cta,
  variant = "primary",
}: {
  ctx: RenderContext;
  cta: Cta;
  /** "primary": brand fill. "ghost": translucent outline. "light": white fill for dark/brand bands. */
  variant?: "primary" | "ghost" | "light";
}) {
  const href = ctaHref(ctx, cta);
  const styles = {
    primary: "bg-brand text-brand-contrast hover:brightness-110 shadow-lg shadow-black/20",
    ghost: "glass border hover:bg-white/15",
    light: "bg-white text-[#16181d] hover:bg-white/90",
  };
  const external = isExternal(href);
  const chat = cta.action.type === "whatsapp" && Boolean(ctx.site.business.whatsapp);
  return (
    <a
      href={href}
      data-cta=""
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`group inline-flex min-h-13 items-center justify-center gap-3 rounded-[var(--button-radius)] px-7 text-sm font-semibold uppercase tracking-[0.12em] transition ${cta.color === "whatsapp" ? "cta-whatsapp bg-[#128c4a] text-white shadow-lg shadow-black/20 hover:bg-[#0f7a40]" : styles[variant]}`}
    >
      {chat && <WhatsAppGlyph className="size-5" />}
      {cta.label}
      {!chat && <Icon name="arrowRight" className="size-4 transition group-hover:translate-x-1" />}
    </a>
  );
}

/** Plain <img> with srcset from pre-generated variants: no runtime image optimization cost. */
export function Picture({
  image,
  sizes,
  priority = false,
  className = "",
  style,
}: {
  image: ResolvedImage & { alt: string };
  sizes: string;
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  // The hero photo is usually the LCP: announce it in <head> so it downloads alongside the CSS.
  if (priority) preload(image.src, { as: "image", fetchPriority: "high", ...(image.srcSet ? { imageSrcSet: image.srcSet, imageSizes: sizes } : {}) });
  return (
    <img
      src={image.src}
      srcSet={image.srcSet}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={image.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={className}
      style={style}
    />
  );
}

/**
 * A framed photo that moves: it uncovers as it enters the screen and drifts
 * with the scroll. Without a photo, branded abstract art keeps the layout whole.
 */
export function Visual({
  image,
  sizes,
  className,
  priority = false,
  motion = true,
  whole = false,
}: {
  image: (ResolvedImage & { alt: string }) | null;
  sizes: string;
  className: string;
  priority?: boolean;
  motion?: boolean;
  /** The whole photo at its own proportions, without the parallax zoom (e.g. a group portrait: nobody cut off). */
  whole?: boolean;
}) {
  if (!image) return <div aria-hidden className={`${className} brand-pattern`} />;
  return (
    <div className={`${className} relative overflow-hidden ${motion ? "reveal-image" : ""}`} style={whole ? { aspectRatio: `${image.width} / ${image.height}` } : undefined}>
      <Picture image={image} sizes={sizes} priority={priority} className={`absolute inset-0 h-full w-full object-cover object-[50%_25%] ${motion && !whole ? "parallax" : ""}`} />
    </div>
  );
}

/** What a video link points to. Only ids, https file URLs and the site's own files are kept: nothing else reaches the page. */
export function parseVideo(url: string | undefined): { kind: "youtube" | "vimeo"; id: string } | { kind: "file"; src: string } | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) return { kind: "youtube", id: yt[1]! };
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d{6,12})/);
  if (vimeo) return { kind: "vimeo", id: vimeo[1]! };
  if (/^https:\/\/[^\s"'<>]+\.mp4(\?[^\s"'<>]*)?$/i.test(url)) return { kind: "file", src: url };
  // A file served by the site itself (e.g. /demo/<site>/hero.mp4): it follows the site to its own domain.
  if (/^\/[A-Za-z0-9_-][A-Za-z0-9._\/-]*\.mp4$/.test(url) && !url.includes("..") && !url.includes("//")) return { kind: "file", src: url };
  return null;
}

/**
 * 16:9 video, or 9:16 when `vertical` (YouTube Shorts, Reels): privacy-friendly YouTube/Vimeo embeds that load only
 * near the viewport, or a native player.
 */
export function VideoFrame({
  url,
  poster,
  title,
  className = "",
  vertical = false,
  posterOverEmbed = false,
}: {
  url: string;
  poster?: (ResolvedImage & { alt: string }) | null;
  title: string;
  className?: string;
  vertical?: boolean;
  /** YouTube/Vimeo: show `poster` with a play button instead of the platform's own thumbnail; the player loads on click. */
  posterOverEmbed?: boolean;
}) {
  const video = parseVideo(url);
  if (!video) return null;
  const frame = `video-frame relative ${vertical ? "video-frame-vertical aspect-[9/16]" : "aspect-video"} w-full overflow-hidden rounded-[var(--brand-radius)] bg-black shadow-2xl ${className}`;
  if (video.kind === "file") {
    return (
      <div className={frame}>
        <video controls playsInline preload="metadata" poster={poster?.src} className="absolute inset-0 h-full w-full object-cover">
          <source src={video.src} type="video/mp4" />
        </video>
      </div>
    );
  }
  const src =
    video.kind === "youtube"
      ? `https://www.youtube-nocookie.com/embed/${video.id}?rel=0&modestbranding=1`
      : `https://player.vimeo.com/video/${video.id}?dnt=1`;
  if (posterOverEmbed && poster) {
    return (
      <div className={frame}>
        <VideoFacade src={src} poster={poster.src} posterAlt={poster.alt} title={title} />
      </div>
    );
  }
  return (
    <div className={frame}>
      <iframe
        src={src}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}
