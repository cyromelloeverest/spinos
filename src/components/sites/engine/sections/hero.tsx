import type { Section } from "@/lib/sites/content";
import { type RenderContext, type ResolvedImage, resolveImage } from "../context";
import { Icon } from "../icons";
import { localHref, ui } from "../i18n";
import { PageHeader } from "../blog";
import { Container, CtaButton, Eyebrow, Highlighted, Picture, Visual, emphasisClass, headingWeight, parseVideo } from "../ui";

type Hero = Extract<Section, { type: "hero" }>;
type Photo = ResolvedImage & { alt: string };

/** Seconds each photo stays on screen in the cross-fade. */
const SLIDE_SECONDS = 7;

/**
 * Keyframes for an n-photo cross-fade. Every slide shares them, offset by its
 * delay; earlier slides sit on top, so the page opens on the first photo even
 * before any animation runs. Pure CSS: no carousel JavaScript.
 */
function slideKeyframes(n: number): string {
  const share = 100 / n;
  const fade = Math.min(4, share / 3);
  const f = (x: number) => `${x.toFixed(2)}%`;
  return `@keyframes es-slides-${n}{0%{opacity:1}${f(share)}{opacity:1}${f(share + fade)}{opacity:0}${f(100 - fade)}{opacity:0}100%{opacity:1}}`;
}

/** Stage captions: shown only while their cut-out is fully on screen, so two never overlap in a cross-fade. */
function captionKeyframes(n: number): string {
  const share = 100 / n;
  const f = (x: number) => `${x.toFixed(2)}%`;
  return `@keyframes es-caption-${n}{0%{opacity:0}${f(1.5)}{opacity:1}${f(share - 1)}{opacity:1}${f(share)}{opacity:0}100%{opacity:0}}`;
}

/**
 * Banners: each one zooms in a touch while it is on screen and resets while
 * hidden; a line under it fills in step, one segment per banner.
 */
function bannerKeyframes(n: number): string {
  const share = 100 / n;
  const fade = Math.min(4, share / 3);
  const f = (x: number) => `${x.toFixed(2)}%`;
  if (n === 1) return "";
  return (
    `@keyframes es-banner-zoom-${n}{0%{transform:scale(1)}${f(share + fade)}{transform:scale(1.04)}${f(share + fade + 0.01)}{transform:scale(1)}100%{transform:scale(1)}}` +
    `@keyframes es-banner-progress-${n}{0%{transform:scaleX(0)}${f(share)}{transform:scaleX(1)}${f(share + fade)}{transform:scaleX(1)}${f(share + fade + 0.01)}{transform:scaleX(0)}100%{transform:scaleX(0)}}`
  );
}

function Backdrop({ photos }: { photos: Photo[] }) {
  if (photos.length === 0) return <div aria-hidden className="brand-pattern absolute inset-0 -z-20" />;
  if (photos.length === 1) {
    return (
      <div aria-hidden className="hero-backdrop absolute inset-0 -z-20 overflow-hidden">
        <div className="hero-depth h-full w-full">
          <Picture image={photos[0]!} sizes="100vw" priority className="ken-burns h-full w-full object-cover" />
        </div>
      </div>
    );
  }
  const n = photos.length;
  return (
    <div aria-hidden className="hero-backdrop absolute inset-0 -z-20 overflow-hidden">
      {/* Only digits are interpolated: no content reaches this style tag. */}
      <style dangerouslySetInnerHTML={{ __html: slideKeyframes(n) }} />
      {photos.map((p, i) => (
        <div
          key={i}
          className="hero-slide absolute inset-0 overflow-hidden"
          style={{
            zIndex: n - i,
            animation: `es-slides-${n} ${n * SLIDE_SECONDS}s linear ${i * SLIDE_SECONDS}s infinite both`,
          }}
        >
          <Picture image={p} sizes="100vw" priority className="ken-burns h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
}

/** A muted, looping video filling the hero behind the overlay; nothing to click, nothing announced. */
function BackgroundVideo({ url }: { url?: string }) {
  const video = parseVideo(url);
  if (!video) return null;
  if (video.kind === "file") {
    return (
      <div aria-hidden className="bg-video absolute inset-0 -z-[15] overflow-hidden">
        <video autoPlay muted loop playsInline preload="metadata" className="h-full w-full object-cover">
          <source src={video.src} type="video/mp4" />
        </video>
      </div>
    );
  }
  const src =
    video.kind === "youtube"
      ? `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&mute=1&loop=1&playlist=${video.id}&controls=0&playsinline=1&rel=0&disablekb=1&iv_load_policy=3&modestbranding=1`
      : `https://player.vimeo.com/video/${video.id}?background=1&dnt=1`;
  return (
    <div aria-hidden className="bg-video absolute inset-0 -z-[15] overflow-hidden">
      <iframe src={src} title="" tabIndex={-1} allow="autoplay; encrypted-media; picture-in-picture" className="bg-video-frame pointer-events-none absolute border-0" />
    </div>
  );
}

/** Delay before the first word rises, and between words, in milliseconds. */
const WORD_START_MS = 150;
const WORD_STEP_MS = 70;

/**
 * Each word rises out of its own mask on load. The words are the heading's only text (no hidden copy), so
 * screen readers, search engines and AI crawlers that skip aria-hidden all read the sentence once.
 */
function KineticHeading({ ctx, text, highlight }: { ctx: RenderContext; text: string; highlight?: string }) {
  const parts = highlight && text.includes(highlight) ? text.split(highlight) : [text];
  const strong = emphasisClass(ctx);
  const words = parts.flatMap((part, i) => [
    ...part.split(/\s+/).filter(Boolean).map((w) => ({ w, strong: false })),
    ...(i < parts.length - 1 ? highlight!.split(/\s+/).filter(Boolean).map((w) => ({ w, strong: true })) : []),
  ]);
  return (
    <>
      {words.map((item, i) => (
        <span key={i}>
          <span className="word-mask">
            <span className={`word-rise ${item.strong ? strong : ""}`} style={{ animationDelay: `${WORD_START_MS + i * WORD_STEP_MS}ms` }}>
              {item.w}
            </span>
          </span>{" "}
        </span>
      ))}
    </>
  );
}

function Headline({ section, ctx, kinetic = false, compact = false }: { section: Hero; ctx: RenderContext; kinetic?: boolean; compact?: boolean }) {
  // Compact: when the title shares the row with a photo or person, it runs on three lines, not five.
  const size = compact ? "text-[2.4rem] sm:text-5xl lg:text-[3.5rem]" : "text-[2.5rem] sm:text-6xl lg:text-[4.4rem]";
  return (
    <h1 className={`font-heading ${size} leading-[1.08] tracking-tight text-balance ${headingWeight(ctx)}`}>
      {kinetic && ctx.site.theme.style !== "editorial" ? (
        <KineticHeading ctx={ctx} text={section.heading} highlight={section.highlight} />
      ) : (
        <Highlighted ctx={ctx} text={section.heading} highlight={section.highlight} />
      )}
    </h1>
  );
}

function Actions({ section, ctx, center = false }: { section: Hero; ctx: RenderContext; center?: boolean }) {
  if (!section.primaryCta && !section.secondaryCta) return null;
  return (
    <div className={`mt-10 flex flex-wrap gap-4 ${center ? "justify-center" : ""}`}>
      {section.primaryCta && <CtaButton ctx={ctx} cta={section.primaryCta} variant="primary" />}
      {section.secondaryCta && <CtaButton ctx={ctx} cta={section.secondaryCta} variant="ghost" />}
    </div>
  );
}

export function HeroSection({ section, ctx }: { section: Hero; ctx: RenderContext }) {
  const photos = [section.image, ...section.images].flatMap((ref) => {
    const p = resolveImage(ctx, ref);
    return p ? [p] : [];
  });

  // Ready-made banners (with their own text) are never cropped: the box takes the banner's proportions.
  if (section.variant === "scene") {
    // A drawn village: sky, two clouds, houses and hills in SVG; the extra photos are cut-out characters
    // standing on the hills, the mark floats where the sun would be with the callout as its speech bubble.
    const characters = section.images.flatMap((ref) => {
      const p = resolveImage(ctx, ref);
      return p ? [p] : [];
    });
    const mascot = resolveImage(ctx, section.mark);
    return (
      <section className="hero-scene relative overflow-hidden" aria-labelledby={`${section.id}-title`}>
        <span aria-hidden className="scene-cloud scene-cloud-1" />
        <span aria-hidden className="scene-cloud scene-cloud-2" />
        {mascot && (
          <div aria-hidden className="scene-mascot">
            {section.callout && <span className="scene-bubble">{section.callout.title}</span>}
            <Picture image={{ ...mascot, alt: "" }} sizes="140px" priority className="h-auto w-full" />
          </div>
        )}
        <Container className="scene-body relative z-[3] pt-12 pb-[15.5rem] sm:pt-16 lg:pb-[17rem]">
          <div className="max-w-2xl">
            <Eyebrow>{section.eyebrow}</Eyebrow>
            <h1 id={`${section.id}-title`} className={`scene-title font-heading text-[2.6rem] leading-[1.02] tracking-tight text-balance sm:text-6xl lg:text-[4.6rem] ${headingWeight(ctx)}`}>
              <Highlighted ctx={ctx} text={section.heading} highlight={section.highlight} />
            </h1>
            {section.subheading && <p className="scene-lead mt-5 max-w-xl text-lg leading-relaxed font-medium text-pretty sm:text-xl">{section.subheading}</p>}
            <Actions section={section} ctx={ctx} />
            {section.badges.length > 0 && (
              <ul className="mt-7 flex flex-wrap gap-3">
                {section.badges.map((b) => (
                  <li key={b} className="scene-proof">{b}</li>
                ))}
              </ul>
            )}
          </div>
        </Container>
        {characters.length > 0 && (
          <div aria-hidden className="scene-characters">
            {characters.map((c) => (
              <Picture key={c.src} image={{ ...c, alt: "" }} sizes="(min-width: 1024px) 200px, 28vw" priority className="scene-character" />
            ))}
          </div>
        )}
        <svg aria-hidden className="scene-village" viewBox="0 0 1440 200" preserveAspectRatio="none">
          <g className="scene-ink" strokeWidth="3">
            <rect x="120" y="40" width="80" height="60" fill="#ff8fb8" />
            <polygon points="108,42 160,4 212,42" fill="#ff5a5f" />
            <rect x="150" y="68" width="20" height="32" fill="#fff8e7" />
            <rect x="1180" y="34" width="96" height="66" fill="var(--brand-accent)" />
            <polygon points="1166,36 1228,-4 1290,36" fill="var(--brand-primary)" />
            <rect x="1216" y="64" width="22" height="36" fill="#fff8e7" />
            <rect x="1310" y="52" width="66" height="48" fill="#2ec4b6" />
            <polygon points="1300,54 1343,22 1386,54" fill="#ff5a5f" />
            <circle cx="270" cy="62" r="28" fill="#3fa63a" />
            <rect x="264" y="80" width="12" height="24" fill="#a0612a" />
          </g>
          <path className="scene-ink" strokeWidth="3" d="M0 96 C 240 56 420 64 620 92 S 1000 130 1200 88 S 1400 66 1440 74 V200 H0Z" fill="#6fcf5b" />
          <path className="scene-ink" strokeWidth="3" d="M0 150 C 300 120 600 132 820 150 S 1250 170 1440 140 V200 H0Z" fill="#4fb544" />
        </svg>
      </section>
    );
  }

  if (section.variant === "banners" && photos.length > 0) {
    const n = photos.length;
    const first = photos[0]!;
    return (
      <section id={section.id} className="tone-light relative">
        <h1 className="sr-only">{section.heading}</h1>
        <div className="relative w-full overflow-hidden bg-surface-alt" style={{ aspectRatio: `${first.width} / ${first.height}` }}>
          {n > 1 && <style dangerouslySetInnerHTML={{ __html: slideKeyframes(n) + bannerKeyframes(n) }} />}
          {photos.map((p, i) => (
            <div
              key={i}
              className="hero-slide absolute inset-0 overflow-hidden"
              style={n > 1 ? { zIndex: n - i, animation: `es-slides-${n} ${n * SLIDE_SECONDS}s linear ${i * SLIDE_SECONDS}s infinite both` } : undefined}
            >
              {/* Every slide loads up front: a lazy slide would show an empty frame on its first turn. */}
              <div
                className={`banner-zoom h-full w-full ${n === 1 ? "banner-zoom-single" : ""}`}
                style={n > 1 ? { animation: `es-banner-zoom-${n} ${n * SLIDE_SECONDS}s ease-out ${i * SLIDE_SECONDS}s infinite both` } : undefined}
              >
                <Picture image={{ ...p, alt: p.alt || section.heading }} sizes="100vw" priority className="h-full w-full object-contain" />
              </div>
            </div>
          ))}
          {n > 1 && (
            <div aria-hidden className="banner-progress absolute inset-x-0 bottom-0 z-20 flex gap-1">
              {photos.map((_, i) => (
                <span key={i} className="relative h-1 flex-1 overflow-hidden bg-black/10">
                  <span
                    className="banner-progress-fill absolute inset-0 origin-left bg-brand"
                    style={{ animation: `es-banner-progress-${n} ${n * SLIDE_SECONDS}s linear ${i * SLIDE_SECONDS}s infinite both` }}
                  />
                </span>
              ))}
            </div>
          )}
        </div>
        {(section.primaryCta || section.secondaryCta || section.subheading) && (
          <Container className="flex flex-col items-start gap-6 py-10 lg:flex-row lg:items-center lg:justify-between">
            {section.subheading && <p className="max-w-2xl text-lg leading-relaxed text-muted">{section.subheading}</p>}
            <div className="flex flex-wrap gap-4">
              {section.primaryCta && <CtaButton ctx={ctx} cta={section.primaryCta} variant="primary" />}
              {section.secondaryCta && <CtaButton ctx={ctx} cta={section.secondaryCta} variant="ghost" />}
            </div>
          </Container>
        )}
      </section>
    );
  }

  // Panels: a printed catalog cover. Big logo, the claim in spaced capitals, products on diagonal panels, pillars below.
  if (section.variant === "panels") {
    const mark = resolveImage(ctx, section.logo);
    const panels = photos.slice(0, 3);
    return (
      <section id={section.id} className="tone-light relative isolate overflow-hidden pt-32 pb-16 sm:pt-36">
        <Container className="text-center">
          {mark && (
            <Picture
              image={{ ...mark, alt: mark.alt || ctx.site.business.name }}
              sizes="(min-width: 640px) 560px, 80vw"
              priority
              className="rise-in mx-auto h-auto w-[min(560px,80vw)]"
            />
          )}
          {!mark && (
            <div className="rise-in">
              <Eyebrow center>{section.eyebrow}</Eyebrow>
            </div>
          )}
          <h1
            className={`rise-in mx-auto text-balance [animation-delay:200ms] ${mark ? "panels-claim mt-8 max-w-4xl font-heading text-base font-semibold uppercase sm:text-xl" : `max-w-5xl font-heading text-[2.6rem] leading-[1] tracking-tight sm:text-6xl lg:text-7xl ${headingWeight(ctx)}`}`}
          >
            {mark ? section.heading : <Highlighted ctx={ctx} text={section.heading} highlight={section.highlight} />}
          </h1>
          {section.subheading && <p className="rise-in mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted [animation-delay:350ms]">{section.subheading}</p>}
          <div className="rise-in [animation-delay:450ms]">
            <Actions section={section} ctx={ctx} center />
          </div>
        </Container>
        {panels.length > 0 && (
          <div className="rise-in mx-auto mt-14 max-w-[1500px] px-4 [animation-delay:300ms] sm:mt-16" style={{ ["--panels" as string]: String(panels.length) }}>
            <div className="panel-strip">
              {panels.map((p, i) => (
                <figure key={i} className="panel">
                  <Picture image={{ ...p, alt: p.alt || "" }} sizes="(min-width: 700px) 33vw, 100vw" priority={i === 0} />
                  {p.alt && <figcaption className="panel-caption mono-label">{p.alt}</figcaption>}
                </figure>
              ))}
            </div>
          </div>
        )}
        {section.badges.length > 0 && (
          <Container>
            <ul className="mt-14 grid grid-cols-2 gap-y-8 border-t border-[var(--line)] pt-10 lg:grid-cols-4">
              {section.badges.map((b, i) => {
                const [title, detail] = b.split(" · ");
                const dot = ["c-k", "c-m", "c-c", "c-y"][i % 4];
                return (
                  <li key={b} className={`px-4 text-center ${i % 4 !== 0 ? "lg:border-l lg:border-[var(--line)]" : ""}`}>
                    <span aria-hidden className={`mx-auto mb-4 block size-3 rounded-full ${dot}`} />
                    <p className="font-heading text-sm font-bold uppercase tracking-[0.08em]">{title}</p>
                    {detail && <p className="mt-1 font-heading text-sm font-bold uppercase tracking-[0.08em] text-brand-text">{detail}</p>}
                  </li>
                );
              })}
            </ul>
          </Container>
        )}
      </section>
    );
  }

  // Showcase: centered claim on a lit dark panel, the product shown in a browser frame, a phone frame overlapping it.
  // Flag: full-bleed photos (cross-fading) with the headline on an accent panel whose base curves, framed by corner brackets.
  if (section.variant === "flag") {
    return (
      <section id={section.id} className="flag-hero tone-dark relative isolate overflow-hidden">
        <Backdrop photos={photos} />
        <BackgroundVideo url={section.backgroundVideo} />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-black/55 via-black/25 to-transparent" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
        <Container className="flex min-h-[78vh] flex-col justify-center pt-16 pb-36 sm:pt-20 lg:min-h-[86vh]">
          <div className="flag-panel rise-in relative max-w-xl px-8 pt-16 pb-20 text-center sm:px-12">
            <span aria-hidden className="flag-corner flag-corner-start" />
            <span aria-hidden className="flag-corner flag-corner-end" />
            {section.eyebrow && <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em]">{section.eyebrow}</p>}
            <h1 className={`font-heading text-[2.4rem] leading-[1.05] tracking-tight text-balance sm:text-6xl ${headingWeight(ctx)}`}>
              <Highlighted ctx={ctx} text={section.heading} highlight={section.highlight} />
            </h1>
            {section.subheading && <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-pretty sm:text-lg">{section.subheading}</p>}
            <Actions section={section} ctx={ctx} center />
          </div>
          {section.badges.length > 0 && (
            <ul className="rise-in mt-10 grid max-w-3xl grid-cols-2 gap-x-8 gap-y-4 [animation-delay:400ms] sm:grid-cols-4">
              {section.badges.map((b) => {
                const [strong, rest] = b.split(" · ");
                return (
                  <li key={b} className="flag-badge border-l-2 pl-3 leading-snug">
                    <span className="block font-heading text-lg font-semibold text-white">{strong}</span>
                    {rest && <span className="block text-sm text-white/75">{rest}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </Container>
      </section>
    );
  }

  // Stage: product cutouts (transparent PNGs) take turns on a lit platform beside the headline.
  if (section.variant === "stage") {
    const n = photos.length;
    // Start just past the last cross-fade, so the page opens on the first machine alone.
    const lead = (Math.min(4, 100 / n / 3) / 100) * n * SLIDE_SECONDS;
    const delay = (i: number) => `${((i - n) * SLIDE_SECONDS - lead).toFixed(2)}s`;
    return (
      <section id={section.id} className="stage-hero tone-dark relative isolate overflow-hidden">
        <div aria-hidden className="stage-plane pointer-events-none absolute inset-0 -z-10" />
        <Container className="grid items-center gap-10 pt-14 pb-14 sm:pt-20 lg:min-h-[calc(100vh-5rem)] lg:grid-cols-[1fr_1.15fr] lg:gap-6 lg:pb-16">
          <div className="relative z-10">
            <div className="rise-in">
              <Eyebrow>{section.eyebrow}</Eyebrow>
            </div>
            <Headline section={section} ctx={ctx} kinetic />
            {section.subheading && (
              <p className="rise-in mt-7 max-w-xl text-lg leading-relaxed text-muted text-pretty [animation-delay:600ms] whitespace-pre-line">{section.subheading}</p>
            )}
            <div className="rise-in [animation-delay:800ms]">
              <Actions section={section} ctx={ctx} />
            </div>
            {section.badges.length > 0 && (
              <ul className="stage-badges rise-in mt-10 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-[var(--line)] pt-6 [animation-delay:950ms] sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                {section.badges.map((b) => {
                  const [strong, rest] = b.split(" · ");
                  return (
                    <li key={b} className="leading-snug">
                      <span className="block font-heading text-xl font-semibold text-ink">{strong}</span>
                      {rest && <span className="mt-1 block text-sm text-muted">{rest}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {n > 0 && (
            <div className="stage relative rise-in [animation-delay:300ms]">
              {n > 1 && <style dangerouslySetInnerHTML={{ __html: slideKeyframes(n) + bannerKeyframes(n) + captionKeyframes(n) }} />}
              <div className="relative aspect-[4/3]">
                <div aria-hidden className="stage-floor absolute inset-x-0 bottom-[12%] h-[30%]" />
                {photos.map((p, i) => (
                  <figure
                    key={i}
                    className="hero-slide absolute inset-0 m-0 flex flex-col"
                    // Cut-outs are transparent, so the waiting ones must start hidden: a negative delay puts each mid-cycle.
                    style={n > 1 ? { zIndex: n - i, animation: `es-slides-${n} ${n * SLIDE_SECONDS}s linear ${delay(i)} infinite both` } : undefined}
                  >
                    <div className="stage-machine relative flex min-h-0 flex-1 items-end justify-center px-[4%] pb-[10%]">
                      <Picture image={{ ...p, alt: p.alt || section.heading }} sizes="(min-width: 1024px) 50vw, 92vw" priority className="max-h-full w-auto max-w-full object-contain" />
                    </div>
                    {p.alt && (
                      <figcaption
                        className="stage-caption flex items-baseline gap-3 text-sm"
                        style={n > 1 ? { animation: `es-caption-${n} ${n * SLIDE_SECONDS}s linear ${delay(i)} infinite both` } : undefined}
                      >
                        <span className="font-mono text-xs text-brand-text">{String(i + 1).padStart(2, "0")}/{String(n).padStart(2, "0")}</span>
                        <span className="font-medium text-ink">{p.alt}</span>
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
              {n > 1 && (
                <div aria-hidden className="banner-progress mt-4 flex gap-1.5">
                  {photos.map((_, i) => (
                    <span key={i} className="relative h-[3px] flex-1 overflow-hidden bg-white/15">
                      <span
                        className="banner-progress-fill absolute inset-0 origin-left bg-accent"
                        style={{ animation: `es-banner-progress-${n} ${n * SLIDE_SECONDS}s linear ${delay(i)} infinite both` }}
                      />
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </Container>
      </section>
    );
  }

  if (section.variant === "showcase") {
    const [screen, phone] = photos;
    return (
      <section id={section.id} className="hero-immersive showcase-hero tone-dark relative isolate overflow-hidden">
        <Container className="pt-36 text-center sm:pt-44">
          <div className="mx-auto max-w-4xl">
            <div className="rise-in">
              <Eyebrow center>{section.eyebrow}</Eyebrow>
            </div>
            <Headline section={section} ctx={ctx} kinetic />
            {section.subheading && (
              <p className="rise-in mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-muted text-pretty [animation-delay:600ms] sm:text-xl whitespace-pre-line">{section.subheading}</p>
            )}
            <div className="rise-in [animation-delay:800ms]">
              <Actions section={section} ctx={ctx} center />
            </div>
            {section.badges.length > 0 && (
              <ul className="rise-in mt-8 flex flex-wrap justify-center gap-x-7 gap-y-3 text-sm text-muted [animation-delay:950ms]">
                {section.badges.map((b) => (
                  <li key={b} className="flex items-center gap-2">
                    <Icon name="check" className="size-4 text-brand-text" />
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {screen && section.frame === "none" && (
            <div className="rise-in mx-auto mt-10 max-w-5xl pb-10 [animation-delay:500ms] sm:mt-14">
              <Picture image={{ ...screen, alt: screen.alt || "" }} sizes="(min-width: 1024px) 1024px, 100vw" priority className="block w-full" />
            </div>
          )}
          {screen && section.frame !== "none" && (
            <div className="rise-in relative mx-auto mt-16 max-w-6xl [animation-delay:500ms] sm:mt-20">
              <div className="browser-frame overflow-hidden rounded-t-[calc(var(--brand-radius)*1.3)] border border-b-0">
                <div aria-hidden className="flex items-center gap-2 px-4 py-3">
                  <span className="size-2.5 rounded-full bg-white/25" />
                  <span className="size-2.5 rounded-full bg-white/25" />
                  <span className="size-2.5 rounded-full bg-white/25" />
                </div>
                <Picture image={{ ...screen, alt: screen.alt || "" }} sizes="(min-width: 1280px) 1152px, 100vw" priority className="block w-full" />
              </div>
              {phone && (
                <div className="phone-frame absolute -right-2 bottom-0 hidden w-[22%] max-w-60 translate-y-[-8%] overflow-hidden rounded-[2rem] border-[6px] sm:block lg:-right-10">
                  <Picture image={{ ...phone, alt: phone.alt || "" }} sizes="240px" className="block w-full" />
                </div>
              )}
            </div>
          )}
        </Container>
      </section>
    );
  }

  if (section.variant === "page") {
    return (
      <PageHeader
        ctx={ctx}
        id={section.id}
        eyebrow={section.eyebrow}
        title={section.heading}
        highlight={section.highlight}
        intro={section.subheading}
        image={section.image}
        logo={section.logo}
        meta={<Actions section={section} ctx={ctx} />}
        aside={(() => {
          // Product cut-outs beside the title (the machine on its own page); a second one stands next to the first.
          const products = section.images.slice(0, 2).flatMap((ref) => {
            const p = resolveImage(ctx, ref);
            return p ? [p] : [];
          });
          if (products.length === 0) return undefined;
          if (products.length === 1) {
            const product = products[0]!;
            return (
              <div className="machine-stage reveal hidden lg:block">
                <Picture image={{ ...product, alt: product.alt || section.heading }} sizes="40vw" priority className="w-full" />
              </div>
            );
          }
          return (
            <div className="machine-stage reveal hidden items-end gap-6 lg:flex">
              {products.map((p, i) => (
                <div key={i} className={i === 0 ? "min-w-0 flex-[1.7]" : "min-w-0 flex-1"}>
                  <Picture image={{ ...p, alt: p.alt || section.heading }} sizes="25vw" priority className="h-auto max-h-[420px] w-full object-contain" />
                </div>
              ))}
            </div>
          );
        })()}
      />
    );
  }

  // Dark scene photo behind, a cut-out person in front on the right, text on the left.
  if (section.variant === "portrait") {
    const scene = resolveImage(ctx, section.images[0]);
    const person = resolveImage(ctx, section.image);
    const mark = resolveImage(ctx, section.mark);
    return (
      <section id={section.id} className="hero-immersive tone-dark relative isolate overflow-hidden">
        {scene ? (
          <div aria-hidden className="absolute inset-0 -z-20 overflow-hidden">
            <Picture image={{ ...scene, alt: "" }} sizes="100vw" priority className="ken-burns h-full w-full object-cover" />
          </div>
        ) : (
          <div aria-hidden className="brand-pattern absolute inset-0 -z-20" />
        )}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            // Editorial: plain darkening only, no colored glow behind the person.
            background:
              ctx.site.theme.style === "executivo"
                ? // The scene shows on the right, softened; the text side deepens into the dark tone with a brand glow.
                  "linear-gradient(90deg, color-mix(in srgb, var(--dark) 97%, transparent) 0%, color-mix(in srgb, var(--dark) 86%, transparent) 40%, color-mix(in srgb, var(--dark) 50%, transparent) 100%), radial-gradient(55% 75% at 76% 62%, color-mix(in srgb, var(--brand-primary) 45%, transparent), transparent 72%)"
                : ctx.site.theme.style === "layered"
                ? // The photo stays visible on the right; the text side melts into the brand's dark tone.
                  "linear-gradient(90deg, var(--dark) 0%, color-mix(in srgb, var(--dark) 92%, transparent) 30%, color-mix(in srgb, var(--dark) 35%, transparent) 62%, color-mix(in srgb, var(--dark) 10%, transparent) 100%), linear-gradient(0deg, color-mix(in srgb, var(--dark) 55%, transparent), transparent 35%)"
                : ctx.site.theme.style === "editorial"
                ? "linear-gradient(90deg, color-mix(in srgb, var(--dark) 94%, transparent) 0%, color-mix(in srgb, var(--dark) 72%, transparent) 50%, color-mix(in srgb, var(--dark) 45%, transparent) 100%)"
                : "linear-gradient(90deg, color-mix(in srgb, var(--dark) 96%, transparent) 0%, color-mix(in srgb, var(--dark) 80%, transparent) 45%, color-mix(in srgb, var(--dark) 35%, transparent) 100%), radial-gradient(60% 70% at 78% 60%, color-mix(in srgb, var(--brand-primary) 38%, transparent), transparent 70%)",
          }}
        />
        <Container className="grid min-h-[min(84svh,720px)] items-center gap-10 pt-32 lg:grid-cols-[1.25fr_0.75fr] lg:pt-24">
          <div className="max-w-3xl py-6">
            <div className="rise-in">
              <Eyebrow>{section.eyebrow}</Eyebrow>
            </div>
            <Headline section={section} ctx={ctx} kinetic compact />
            {section.subheading && (
              <p className="rise-in mt-7 max-w-xl text-lg leading-relaxed text-muted text-pretty [animation-delay:700ms] whitespace-pre-line">{section.subheading}</p>
            )}
            <div className="rise-in [animation-delay:900ms]">
              <Actions section={section} ctx={ctx} />
            </div>
          </div>
          <div className="relative flex h-full items-end justify-center self-end">
            {/* Fine brand outline behind the person; only drawn by the "layered" style. */}
            <svg aria-hidden viewBox="0 0 400 400" className="deco-ring pointer-events-none absolute bottom-6 left-1/2 w-[min(92%,460px)] -translate-x-1/2">
              <circle cx="200" cy="200" r="196" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M200 4 A196 196 0 0 1 396 200" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
            </svg>
            {mark && (
              <Picture
                image={{ ...mark, alt: "" }}
                sizes="(min-width: 1024px) 36vw, 70vw"
                className="hero-mark pointer-events-none absolute bottom-[12%] left-1/2 w-[min(108%,560px)] max-w-none -translate-x-1/2 opacity-[0.13]"
              />
            )}
            {person && (
              <Picture
                image={{ ...person, alt: person.alt || "" }}
                sizes="(min-width: 1024px) 40vw, 80vw"
                priority
                className="rise-in relative max-h-[520px] w-auto max-w-full object-contain object-bottom drop-shadow-[0_30px_50px_rgb(0_0_0/0.45)] [animation-delay:300ms]"
              />
            )}
            {section.callout && (
              <div
                className={`rise-in absolute bottom-10 left-0 flex max-w-xs items-center gap-4 rounded-[var(--brand-radius)] border p-5 shadow-2xl [animation-delay:1100ms] sm:left-auto sm:-right-6 ${ctx.site.theme.style === "editorial" ? "border-white/10 bg-[color-mix(in_srgb,var(--dark)_92%,white)]" : "glass"}`}
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-brand-contrast">
                  <Icon name={section.callout.icon ?? "users"} className="size-6" />
                </span>
                <p className="leading-snug">
                  <span className="block text-sm text-muted">{section.callout.title}</span>
                  {section.callout.text && <span className="mt-1 block text-xl font-semibold">{section.callout.text}</span>}
                </p>
              </div>
            )}
          </div>
        </Container>
      </section>
    );
  }

  if (section.variant === "band") {
    // A short strip under the overlay header: a photo or looping video, with the page's name or nothing at all.
    return (
      <section id={section.id} className="hero-band hero-immersive tone-dark relative isolate overflow-hidden">
        <Backdrop photos={photos} />
        <BackgroundVideo url={section.backgroundVideo} />
        {section.overlay === "duotone" && <div aria-hidden className="duotone absolute inset-0 -z-10" />}
        {(section.overlay === "dark" || section.overlay === "brand") && <div aria-hidden className="absolute inset-0 -z-10" style={{ background: section.overlay === "dark" ? "rgb(0 0 0 / 0.55)" : "color-mix(in srgb, var(--dark) 70%, transparent)" }} />}
        <Container className={`hero-band-inner flex items-center ${section.headingHidden ? "" : "pb-16"}`}>
          <h1 className={section.headingHidden ? "sr-only" : "font-heading text-5xl leading-tight font-bold text-white sm:text-6xl"}>{section.heading}</h1>
        </Container>
      </section>
    );
  }

  // Immersive: photos edge to edge under the translucent header, glass trust bar at the bottom.
  if (section.variant === "fullscreen" || section.variant === "background") {
    const tall = section.variant === "fullscreen";
    return (
      <section
        id={section.id}
        className={`hero-immersive hero-lead tone-dark relative isolate flex flex-col overflow-hidden ${tall ? "min-h-[min(100svh,980px)]" : ""}`}
      >
        <Backdrop photos={photos} />
        <BackgroundVideo url={section.backgroundVideo} />
        {section.overlay === "dark" && <div aria-hidden className="absolute inset-0 -z-10 bg-black/45" />}
        {section.overlay === "brand" && <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(90deg, color-mix(in srgb, var(--dark) 88%, transparent) 0%, color-mix(in srgb, var(--dark) 55%, transparent) 50%, color-mix(in srgb, var(--dark) 15%, transparent) 100%), linear-gradient(0deg, color-mix(in srgb, var(--dark) 70%, transparent) 0%, transparent 40%)",
          }}
        />}
        <Container className={`flex flex-1 items-center pt-32 ${tall ? "pb-12" : "pb-24 sm:pt-44 sm:pb-32"}`}>
          <div className="max-w-3xl">
            <div className="rise-in">
              <Eyebrow>{section.eyebrow}</Eyebrow>
            </div>
            <Headline section={section} ctx={ctx} kinetic />
            {section.subheading && (
              <p className="rise-in mt-7 max-w-xl text-lg leading-relaxed text-muted text-pretty [animation-delay:700ms] sm:text-xl whitespace-pre-line">{section.subheading}</p>
            )}
            <div className="rise-in [animation-delay:900ms]">
              <Actions section={section} ctx={ctx} />
            </div>
          </div>
        </Container>
        {section.callout && (
          // Glass card over the photo (desktop); on phones it sits under the buttons.
          <Container className="hero-callout rise-in relative pb-10 [animation-delay:1000ms] lg:absolute lg:inset-x-0 lg:bottom-16 lg:pb-0">
            <div className="glass flex max-w-sm items-center gap-4 rounded-[var(--brand-radius)] border p-5 lg:ml-auto">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-brand-contrast">
                <Icon name={section.callout.icon ?? "users"} className="size-6" />
              </span>
              <p className="leading-snug">
                <span className="block text-sm text-muted">{section.callout.title}</span>
                {section.callout.text && <span className="mt-1 block text-xl font-semibold">{section.callout.text}</span>}
              </p>
            </div>
          </Container>
        )}
        {section.pillars.length > 0 && (
          // Pillars along the foot of the photo: icon, a spaced label and a quiet outline link.
          <Container className="hero-pillars rise-in pb-12 [animation-delay:1100ms]">
            <ul className="grid border-t border-white/30 sm:grid-cols-3">
              {section.pillars.map((p) => (
                <li key={p.label} className="flex flex-col items-center gap-4 border-white/30 px-6 pt-8 text-center sm:border-l sm:first:border-l-0">
                  {p.icon && <Icon name={p.icon} className="size-9 text-white" />}
                  <span className="text-lg font-light uppercase tracking-[0.35em] text-white">{p.label}</span>
                  <a href={localHref(ctx, p.href)} className="border border-white/80 px-5 py-2 text-sm text-white transition hover:bg-white hover:text-[var(--dark)]">
                    {ui(ctx).learnMore}
                  </a>
                </li>
              ))}
            </ul>
          </Container>
        )}
        {section.badges.length > 0 && (
          <Container className="rise-in pb-10 [animation-delay:1100ms]">
            <ul className="glass grid gap-px overflow-hidden rounded-[var(--brand-radius)] border sm:grid-cols-3">
              {section.badges.map((b) => (
                <li key={b} className="flex items-center gap-3 px-6 py-5 text-sm font-medium">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-brand-contrast">
                    <Icon name="check" className="size-4" />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </Container>
        )}
      </section>
    );
  }

  if (section.variant === "split") {
    return (
      <section id={section.id} className="tone-light relative overflow-hidden">
        <Container className="grid items-center gap-12 py-12 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-32">
          <div className="reveal">
            <Eyebrow>{section.eyebrow}</Eyebrow>
            <Headline section={section} ctx={ctx} />
            {section.subheading && <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted whitespace-pre-line">{section.subheading}</p>}
            <Actions section={section} ctx={ctx} />
            {section.badges.length > 0 && (
              <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted">
                {section.badges.map((b) => (
                  <li key={b} className="flex items-center gap-2">
                    <Icon name="check" className="size-4 text-brand-text" />
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* On phones the photo comes first and wider, so a face or product shows without scrolling. */}
          <div className="split-media relative order-first mr-4 lg:order-none lg:mr-0">
            <div aria-hidden className="split-deco absolute -right-4 -bottom-4 left-8 top-8 rounded-[var(--brand-radius)] bg-brand/90" />
            <Visual image={photos[0] ?? null} sizes="(min-width: 1024px) 45vw, 100vw" priority className="split-photo relative aspect-[4/3] w-full rounded-[var(--brand-radius)] shadow-2xl sm:aspect-[4/5]" />
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section id={section.id} className="tone-muted relative overflow-hidden">
      <div aria-hidden className="absolute inset-x-0 top-0 h-full opacity-60 [background:radial-gradient(60%_60%_at_50%_0%,color-mix(in_srgb,var(--brand-primary)_14%,transparent),transparent)]" />
      <Container className="relative py-28 text-center sm:py-36">
        <div className="reveal mx-auto max-w-4xl">
          <Eyebrow center>{section.eyebrow}</Eyebrow>
          <Headline section={section} ctx={ctx} />
          {section.subheading && <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-muted whitespace-pre-line">{section.subheading}</p>}
          <Actions section={section} ctx={ctx} center />
        </div>
      </Container>
    </section>
  );
}
