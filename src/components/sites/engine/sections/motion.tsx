import type { CSSProperties } from "react";
import type { Section } from "@/lib/sites/content";
import { type RenderContext, resolveImage } from "../context";
import { Container, CtaButton, Eyebrow, Picture, SectionShell, emphasisClass, headingTag, headingWeight, toneOf } from "../ui";

type Of<T extends Section["type"]> = Extract<Section, { type: T }>;

/** Seconds per phrase: long lists scroll at the same reading speed as short ones. */
const MARQUEE_SECONDS_PER_ITEM = 4.5;

export function MarqueeSection({ section, ctx }: { section: Of<"marquee">; ctx: RenderContext }) {
  const outline = section.variant === "outline";
  const Heading = headingTag(ctx);
  if (section.variant === "grid") {
    return (
      <section id={section.id} className={`tone-${toneOf(section, "light")} relative py-16 sm:py-20`}>
        <Container className="grid gap-10 lg:grid-cols-[14rem_1fr] lg:gap-16">
          <div className="reveal">
            <Eyebrow>{section.eyebrow}</Eyebrow>
            {section.heading && <Heading className={`font-heading text-2xl leading-tight tracking-tight ${headingWeight(ctx)}`}>{section.heading}</Heading>}
          </div>
          <ul className="grid grid-cols-1 border-t border-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
            {section.items.map((item, i) => (
              <li key={`${item}-${i}`} className="reveal group flex items-baseline gap-4 border-b border-[var(--line)] py-5 pr-4 sm:[&:nth-child(odd)]:border-r lg:border-r lg:[&:nth-child(4n)]:border-r-0 lg:pl-5 lg:[&:nth-child(4n+1)]:pl-0">
                <span className="text-xs font-semibold tracking-[0.18em] text-brand-text">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-medium leading-snug transition group-hover:text-brand-text">{item}</span>
              </li>
            ))}
          </ul>
        </Container>
      </section>
    );
  }
  if (section.variant === "photos") {
    // Photos scrolling sideways; each caption (from `items`) sits on its photo.
    const photos = section.images.map((ref) => resolveImage(ctx, ref)).filter((p) => p !== null);
    const strip = (hidden: boolean) => (
      <ul aria-hidden={hidden || undefined} className="marquee-copy flex shrink-0 items-center gap-4 pr-4 sm:gap-6 sm:pr-6">
        {photos.map((photo, i) => (
          <li key={`${photo.src}-${i}`} className="marquee-photo relative h-60 shrink-0 overflow-hidden rounded-[var(--brand-radius)] sm:h-80" style={{ aspectRatio: `${photo.width} / ${photo.height}` }}>
            <Picture image={{ ...photo, alt: hidden ? "" : photo.alt || section.items[i] || "" }} sizes="480px" className="h-full w-full object-cover" />
            {section.items[i] && (
              <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">{section.items[i]}</span>
            )}
          </li>
        ))}
      </ul>
    );
    return (
      <section id={section.id} className={`tone-${toneOf(section, "light")} marquee relative overflow-hidden py-14 sm:py-20`}>
        {(section.heading || section.eyebrow) && (
          <Container className="mb-10">
            <Eyebrow>{section.eyebrow}</Eyebrow>
            {section.heading && <Heading className={`font-heading text-3xl leading-tight tracking-tight sm:text-4xl ${headingWeight(ctx)}`}>{section.heading}</Heading>}
          </Container>
        )}
        <div className="marquee-track flex w-max" style={{ "--marquee-duration": `${Math.max(photos.length, 2) * 6}s` } as CSSProperties}>
          {strip(false)}
          {strip(true)}
        </div>
      </section>
    );
  }
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="marquee-copy flex shrink-0 items-center">
      {section.items.map((item, i) => (
        <li key={`${item}-${i}`} className="flex items-center">
          <span className={`px-8 font-heading text-4xl tracking-tight whitespace-nowrap sm:px-12 sm:text-6xl ${outline ? "marquee-outline font-semibold" : "font-light text-ink/80"}`}>
            {item}
          </span>
          <span aria-hidden className="size-2.5 shrink-0 rotate-45 bg-brand" />
        </li>
      ))}
    </ul>
  );
  return (
    <section id={section.id} className={`tone-${toneOf(section, "light")} marquee relative overflow-hidden border-y border-[var(--line)] py-10 sm:py-14`}>
      {section.heading && <Heading className="sr-only">{section.heading}</Heading>}
      <div className="marquee-track flex w-max" style={{ "--marquee-duration": `${section.items.length * MARQUEE_SECONDS_PER_ITEM}s` } as CSSProperties}>
        {row(false)}
        {row(true)}
      </div>
    </section>
  );
}

type Word = { text: string; strong: boolean; tight: boolean };

/** Splits the statement into words, marking those inside the highlight. */
function words(text: string, highlight?: string): Word[] {
  const parts = highlight && text.includes(highlight) ? text.split(highlight) : [text];
  const list: Word[] = [];
  // "tight": the word follows the previous one with no space, e.g. a comma right after the highlight.
  const push = (chunk: string, strong: boolean, spaced: boolean) =>
    chunk.split(/\s+/).filter(Boolean).forEach((w, j) => list.push({ text: w, strong, tight: j === 0 && !spaced }));
  parts.forEach((part, i) => {
    push(part, false, i === 0 || /^\s/.test(part));
    if (i < parts.length - 1) push(highlight!, true, part === "" || /\s$/.test(part));
  });
  return list;
}

/** Share of the section's scroll (CSS "cover" range) over which the words light up. */
const FILL_START = 6;
const FILL_SPAN = 34;

export function StatementSection({ section, ctx }: { section: Of<"statement">; ctx: RenderContext }) {
  const reveal = section.variant === "reveal";
  const list = words(section.text, section.highlight);
  const strong = emphasisClass(ctx);
  const Heading = headingTag(ctx);
  if (section.variant === "portrait") {
    const person = resolveImage(ctx, section.image);
    return (
      <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage} className="statement-portrait overflow-hidden !pb-0">
        <Container className="grid items-end gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="order-last lg:order-none">
            {person && (
              <Picture
                image={{ ...person, alt: person.alt || "" }}
                sizes="(min-width: 1024px) 45vw, 90vw"
                className="mx-auto max-h-[560px] w-auto max-w-full object-contain object-bottom grayscale lg:max-h-[760px]"
              />
            )}
          </div>
          <div className="reveal self-center pb-12 lg:pb-[var(--section-py)]">
            <Eyebrow>{section.eyebrow}</Eyebrow>
            {section.heading && <Heading className="sr-only">{section.heading}</Heading>}
            <span aria-hidden className="block font-heading text-8xl leading-[0.6] font-bold text-brand-text">“</span>
            <p className="mt-6 font-heading text-3xl leading-[1.25] font-light tracking-tight text-balance text-brand-text sm:text-[2.6rem] sm:leading-[1.2]">
              {list.map((w, i) => (
                <span key={i}>
                  {i > 0 && !w.tight && " "}
                  <span className={w.strong ? "font-bold" : ""}>{w.text}</span>
                </span>
              ))}
            </p>
            {section.caption && <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-muted">{section.caption}</p>}
            {section.cta && (
              <div className="mt-10">
                <CtaButton ctx={ctx} cta={section.cta} variant="primary" />
              </div>
            )}
          </div>
        </Container>
      </SectionShell>
    );
  }
  return (
    <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage} className={reveal ? "statement statement-band" : "statement-band"}>
      <Container className={reveal ? "" : "text-center"}>
        <div className={reveal ? "max-w-5xl" : "mx-auto max-w-4xl"}>
          <Eyebrow center={!reveal}>{section.eyebrow}</Eyebrow>
          {section.heading && <Heading className="sr-only">{section.heading}</Heading>}
          <p className={`font-heading text-3xl leading-[1.25] tracking-tight text-balance sm:text-5xl sm:leading-[1.18] ${headingWeight(ctx)}`}>
            {list.map((w, i) => {
              // Only numbers are interpolated into the style: each word lights up a little after the previous one.
              const from = FILL_START + (FILL_SPAN * i) / list.length;
              const style = reveal ? ({ animationRange: `cover ${from.toFixed(1)}% cover ${(from + FILL_SPAN / list.length + 6).toFixed(1)}%` } as CSSProperties) : undefined;
              return (
                <span key={i}>
                  {i > 0 && !w.tight && " "}
                  <span className={`${reveal ? "statement-word" : ""} ${w.strong ? strong : ""}`} style={style}>
                    {w.text}
                  </span>
                </span>
              );
            })}
          </p>
          {section.caption && <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-muted">{section.caption}</p>}
          {section.cta && (
            <div className="mt-10">
              <CtaButton ctx={ctx} cta={section.cta} variant="primary" />
            </div>
          )}
        </div>
      </Container>
    </SectionShell>
  );
}
