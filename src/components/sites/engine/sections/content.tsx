import type { CSSProperties } from "react";
import type { Section } from "@/lib/sites/content";
import type { ReactNode } from "react";
import { type RenderContext, isExternal, resolveImage } from "../context";
import { Icon } from "../icons";
import { ui } from "../i18n";
import { RichText } from "../blog";
import { Container, CtaButton, Eyebrow, Highlighted, Picture, SectionShell, SectionTitle, VideoFrame, Visual, headingTag, headingWeight, parseVideo, toneOf } from "../ui";

type Of<T extends Section["type"]> = Extract<Section, { type: T }>;

/** An opening text: plain by default; paragraphs that start with "> " read as a pull quote, and **bold** and [links](/x) work. */
function AboutBody({ text }: { text: string }) {
  if (!/(^|\n)> |\*\*|\]\(/.test(text)) return <p className="mt-7 text-lg leading-relaxed text-muted text-pretty whitespace-pre-line">{text}</p>;
  return (
    <div className="about-rich mt-7 space-y-4 text-lg leading-relaxed text-muted text-pretty">
      {text.split(/\n{2,}/).map((part, i) =>
        part.startsWith("> ") ? (
          <blockquote key={i} className="about-quote pl-8 font-semibold text-ink"><RichText text={part.slice(2)} /></blockquote>
        ) : (
          <p key={i} className="whitespace-pre-line"><RichText text={part} /></p>
        ),
      )}
    </div>
  );
}

export function AboutSection({ section, ctx }: { section: Of<"about">; ctx: RenderContext }) {
  const withImage = section.variant !== "text-only";
  const image = withImage ? resolveImage(ctx, section.image) : null;
  const imageFirst = section.variant === "image-left";
  const screen = section.imageFit === "screen" && !section.video;
  const Heading = headingTag(ctx);

  const text = (
    <div className="reveal">
      <Eyebrow>{section.eyebrow}</Eyebrow>
      {section.heading && (
        <Heading className={`font-heading text-4xl leading-[1.1] tracking-tight text-balance sm:text-5xl ${headingWeight(ctx)}`}>
          <Highlighted ctx={ctx} text={section.heading} highlight={section.highlight} />
        </Heading>
      )}
      <AboutBody text={section.body} />
      {section.highlights.length > 0 && (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {section.highlights.map((h) => (
            <li key={h} className="flex items-start gap-3 font-medium">
              <span className="highlight-mark mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-brand-contrast">
                <Icon name="check" className="size-3.5" />
              </span>
              {h}
            </li>
          ))}
        </ul>
      )}
      {section.cta && (
        <div className="mt-10 flex flex-wrap gap-3">
          {section.secondaryCta && <CtaButton ctx={ctx} cta={section.secondaryCta} variant="ghost" />}
          <CtaButton ctx={ctx} cta={section.cta} variant="primary" />
        </div>
      )}
    </div>
  );

  if (!withImage) {
    return (
      <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage}>
        <Container className="max-w-4xl">{text}</Container>
      </SectionShell>
    );
  }

  return (
    <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage}>
      <Container className={`grid items-center gap-16 ${screen ? (imageFirst ? "lg:grid-cols-[1.35fr_1fr]" : "lg:grid-cols-[1fr_1.35fr]") : "lg:grid-cols-2"}`}>
        <div className={`about-media relative ${imageFirst ? "" : "lg:order-2"}`}>
          <div aria-hidden className={`about-deco absolute -top-5 h-2/3 w-2/3 rounded-[var(--brand-radius)] bg-brand/15 ${imageFirst ? "-left-5" : "-right-5"}`} />
          {section.video && parseVideo(section.video) ? (
            <VideoFrame url={section.video} poster={image} posterOverEmbed title={section.heading ?? ui(ctx).video} className="relative" />
          ) : screen && image ? (
            <div className="screen-shot relative">
              <div className="browser-frame relative overflow-hidden rounded-[calc(var(--brand-radius)*0.9)] border">
                <div aria-hidden className="flex items-center gap-2 px-4 py-2.5">
                  <span className="size-2 rounded-full bg-white/25" />
                  <span className="size-2 rounded-full bg-white/25" />
                  <span className="size-2 rounded-full bg-white/25" />
                </div>
                <Picture image={image} sizes="(min-width: 1024px) 58vw, 95vw" className="block h-auto w-full" />
              </div>
            </div>
          ) : section.imageFit === "logo" && image ? (
            <div className="logo-panel relative mx-auto grid aspect-square w-full max-w-[26rem] place-items-center rounded-[calc(var(--brand-radius)*1.2)] bg-white shadow-xl">
              <Picture image={image} sizes="(min-width: 1024px) 32vw, 70vw" className="h-auto max-h-[60%] w-[72%] object-contain" />
            </div>
          ) : section.imageFit === "product" && image ? (
            <div className="lead-panel product-panel relative aspect-[4/5] w-full overflow-hidden rounded-[calc(var(--brand-radius)*1.2)] shadow-xl">
              <Picture image={image} sizes="(min-width: 1024px) 45vw, 90vw" className="absolute inset-0 m-auto h-[84%] w-[84%] object-contain drop-shadow-[0_30px_40px_rgb(0_0_0/0.45)]" />
            </div>
          ) : (
            <Visual image={image} whole={section.imageFit === "whole"} sizes="(min-width: 1024px) 50vw, 100vw" className="about-photo relative aspect-[4/5] w-full rounded-[var(--brand-radius)] shadow-xl" />
          )}
        </div>
        {text}
      </Container>
    </SectionShell>
  );
}

function ItemLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      {...(isExternal(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-brand-text"
    >
      {label} <Icon name="arrowRight" className="size-4" />
    </a>
  );
}

export function ServicesSection({ section, ctx }: { section: Of<"services">; ctx: RenderContext }) {
  const variant = section.variant;
  // If any card image is a wide banner, every card in the row takes the banner's proportions.
  const wideImage =
    variant === "cards"
      ? section.items.map((it) => resolveImage(ctx, it.image)).find((im) => im && im.width / im.height > 1.9)
      : undefined;
  const wideRatio = wideImage ? `${wideImage.width} / ${wideImage.height}` : undefined;
  // In a strip, one logo switches every item to the stacked layout so the row stays aligned.
  const stripLogos = variant === "strip" && section.items.some((it) => it.image);
  const linkLabel = section.linkLabel || ui(ctx).learnMore;
  const linked = (href: string | undefined, className: string, body: ReactNode) =>
    href ? (
      <a href={href} {...(isExternal(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={className}>
        {body}
      </a>
    ) : (
      <div className={className}>{body}</div>
    );

  if (variant === "columns") {
    // Full-width photo columns, edge to edge: the segments of a catalog side by side.
    const titled = Boolean(section.heading || section.intro);
    return (
      <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} className={`service-columns-section ${titled ? "pb-0!" : "py-0!"}`}>
        {titled && (
          <Container>
            <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} />
          </Container>
        )}
        <ul className="service-columns grid sm:grid-cols-2 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none">
          {section.items.map((item, i) => {
            const image = resolveImage(ctx, item.image);
            return (
              <li key={`${item.title}-${i}`} className="min-w-0">
                {linked(
                  item.href,
                  "service-column group relative isolate flex h-full min-h-[24rem] flex-col justify-end overflow-hidden p-6 text-white sm:min-h-[28rem] lg:min-h-[34rem] lg:p-7",
                  <>
                    {image ? (
                      <Picture image={{ ...image, alt: "" }} sizes="(min-width: 1024px) 20vw, (min-width: 640px) 50vw, 100vw" className="absolute inset-0 -z-20 h-full w-full object-cover transition duration-[1.2s] ease-out group-hover:scale-105" />
                    ) : (
                      <div aria-hidden className="brand-pattern absolute inset-0 -z-20" />
                    )}
                    <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--dark)_10%,transparent)_30%,color-mix(in_srgb,var(--dark)_85%,transparent)_100%)]" />
                    <h3 className="font-heading text-lg leading-snug font-medium">{item.title}</h3>
                    {item.description && <p className="mt-3 text-sm leading-relaxed text-white/85">{item.description}</p>}
                    {item.href && (
                      <span className="service-column-button mt-6 inline-flex self-start rounded-[var(--button-radius)] bg-brand px-5 py-2.5 text-sm text-brand-contrast transition group-hover:brightness-125">
                        {linkLabel}
                      </span>
                    )}
                  </>,
                )}
              </li>
            );
          })}
        </ul>
      </SectionShell>
    );
  }

  if (variant === "slides") {
    // One item at a time: photo on one side, text on the other. Radio inputs switch the slides, so it works
    // without JavaScript and with the keyboard (arrow keys move between them); the tabs and arrows are their labels.
    const name = `slides-${section.id}`;
    const total = section.items.length;
    const at = (i: number) => `${name}-${(i + total) % total}`;
    const active = section.items.map((_, i) => `.slides-${section.id}:has(#${at(i)}:checked) label[data-tab="${i}"]`).join(",");
    return (
      <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage}>
        <Container>
          <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} />
          <style>{`${active}{background:var(--brand-primary);color:var(--brand-on-primary);border-color:transparent}`}</style>
          <div className={`slides slides-${section.id} reveal`}>
            <div className="slides-tabs -mx-5 mb-8 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-hidden>
              {section.items.map((item, i) => (
                <label key={i} htmlFor={at(i)} data-tab={i} className="flex shrink-0 cursor-pointer items-center gap-2 rounded-[var(--button-radius)] border border-[var(--line)] px-4 py-2.5 text-sm font-semibold transition hover:border-current">
                  <span className="tabular-nums opacity-60">{String(i + 1).padStart(2, "0")}</span>
                  {item.title}
                </label>
              ))}
            </div>
            {section.items.map((item, i) => {
              const image = resolveImage(ctx, item.image);
              return (
                <div key={`${item.title}-${i}`} className="contents">
                  <input type="radio" name={name} id={at(i)} defaultChecked={i === 0} className="slides-input" aria-label={item.title} />
                  <div className={`slide grid items-center gap-8 lg:gap-14 ${image ? "lg:grid-cols-2" : ""}`}>
                    {image && <Picture image={image} sizes="(min-width: 1024px) 45vw, 100vw" className="aspect-[4/3] w-full rounded-[var(--brand-radius)] object-cover lg:aspect-[5/4]" />}
                    <div>
                      <p className="font-heading text-sm font-semibold tracking-[0.2em] text-brand-text tabular-nums">
                        {String(i + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
                      </p>
                      <h3 className="mt-4 font-heading text-3xl font-semibold leading-tight sm:text-4xl">{item.title}</h3>
                      {item.description && <p className="mt-5 text-lg leading-relaxed text-muted whitespace-pre-line">{item.description}</p>}
                      <div className="mt-8 flex gap-3" aria-hidden>
                        <label htmlFor={at(i - 1)} className="flex size-12 cursor-pointer items-center justify-center rounded-full border border-[var(--line)] transition hover:border-current">
                          <Icon name="arrowRight" className="size-5 rotate-180" />
                        </label>
                        <label htmlFor={at(i + 1)} className="flex size-12 cursor-pointer items-center justify-center rounded-full bg-brand text-brand-contrast transition hover:brightness-110">
                          <Icon name="arrowRight" className="size-5" />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Container>
      </SectionShell>
    );
  }

  if (variant === "buttons") {
    return (
      <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage}>
        <Container>
          <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} center />
          <ul className="mx-auto grid max-w-4xl gap-10 sm:grid-cols-2">
            {section.items.map((item) => {
              const art = resolveImage(ctx, item.image);
              return (
                <li key={item.title} className="flex flex-col items-center justify-end gap-6">
                  {art && <Picture image={art} sizes="(min-width: 640px) 28rem, 100vw" className="h-auto max-h-64 w-auto max-w-full object-contain" />}
                  {item.href && <CtaButton ctx={ctx} cta={{ label: item.title, action: { type: "link", href: item.href } }} variant="primary" />}
                </li>
              );
            })}
          </ul>
        </Container>
      </SectionShell>
    );
  }

  if (variant === "links") {
    // An equipment index: small cards with a coloured left edge, each leading to its page.
    return (
      <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage} className="service-links-section">
        <Container>
          <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} center className="mb-8" />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.items.map((item, i) => (
              <li key={`${item.title}-${i}`} className="min-w-0">
                {linked(
                  item.href,
                  "service-link block h-full rounded-[6px] border border-[var(--line)] border-l-[3px] border-l-brand bg-white px-5 py-4 text-[#1b1d26] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                  <>
                    <span className="block font-heading text-sm font-semibold text-brand-text">{item.title}</span>
                    {item.description && <span className="mt-1 block text-sm leading-snug whitespace-pre-line text-muted">{item.description}</span>}
                  </>,
                )}
              </li>
            ))}
          </ul>
        </Container>
      </SectionShell>
    );
  }

  if (variant === "agenda") {
    // Deep band: heading and intro, a photo, and the items as a checked list of white cards (e.g. the events of the year).
    const photo = resolveImage(ctx, section.image);
    return (
      <SectionShell id={section.id} tone={toneOf(section, "dark")} ctx={ctx} backdrop={section.backgroundImage}>
        <Container className={`grid items-center gap-10 lg:gap-12 ${photo ? "lg:grid-cols-[1fr_0.9fr_1.1fr]" : "lg:grid-cols-[1fr_1.1fr]"}`}>
          <div className="reveal">
            <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} className="mb-0" />
          </div>
          {photo && <Picture image={photo} sizes="(min-width: 1024px) 28vw, 100vw" className="agenda-section-photo reveal aspect-[4/3] w-full rounded-[var(--brand-radius)] object-cover" />}
          <ul className="reveal grid gap-3">
            {section.items.map((item, i) => (
              <li key={`${item.title}-${i}`}>
                {linked(
                  item.href,
                  `agenda-item flex items-start gap-4 rounded-[var(--brand-radius)] px-5 py-4 text-[#1b1d26] shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${item.featured ? "agenda-item-featured bg-[var(--brand-accent)]" : "bg-white"}`,
                  <>
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-brand-contrast">
                      <Icon name="check" className="size-3.5" strokeWidth={2.5} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-heading leading-snug font-medium">{item.title}</span>
                      {item.description && <span className="mt-0.5 block text-sm leading-relaxed whitespace-pre-line text-[#5b6070]">{item.description}</span>}
                    </span>
                  </>,
                )}
              </li>
            ))}
          </ul>
        </Container>
      </SectionShell>
    );
  }

  return (
    <SectionShell id={section.id} tone={toneOf(section, variant === "icons" ? "dark" : variant === "panels" || variant === "strip" ? "light" : "muted")} ctx={ctx} backdrop={section.backgroundImage}>
      <Container>
        <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} />
        {variant === "numbered" ? (
          // Numbered cards: small index, title in the brand color, an arrow when the card links somewhere.
          <ul className={`grid gap-4 sm:grid-cols-2 ${section.items.length % 3 === 0 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
            {section.items.map((item, i) => {
              const body = (
                <>
                  <span className="font-heading text-sm font-semibold text-brand-text tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-6 font-heading text-xl font-semibold leading-snug text-brand-text">{item.title}</h3>
                  {item.description && <p className="mt-3 flex-1 leading-relaxed text-muted">{item.description}</p>}
                  {item.href && <Icon name="arrowUpRight" className="mt-6 size-5 self-end text-brand-text transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />}
                </>
              );
              const box = "numbered-card group reveal flex h-full flex-col rounded-[var(--brand-radius)] border p-7 transition duration-300";
              return (
                <li key={`${item.title}-${i}`}>
                  {item.href ? (
                    <a href={item.href} {...(isExternal(item.href) ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={box}>
                      {body}
                    </a>
                  ) : (
                    <div className={box}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : variant === "calendar" ? (
          // Event calendar: the event's logo on white, the date (title) and venue (description) on the brand color.
          <ul className={`calendar-list grid gap-4 sm:grid-cols-2 ${section.items.length >= 4 ? "lg:grid-cols-4" : section.items.length === 3 ? "lg:grid-cols-3" : ""}`}>
            {section.items.map((item, i) => {
              const logo = resolveImage(ctx, item.image);
              const body = (
                <>
                  <div className="calendar-logo flex h-28 items-center justify-center bg-white px-6">
                    {logo ? (
                      <Picture image={{ ...logo, alt: logo.alt || item.title }} sizes="240px" className="max-h-16 w-auto max-w-full object-contain" />
                    ) : (
                      <Icon name="calendar" className="size-8 text-brand-text" />
                    )}
                  </div>
                  <div className="calendar-date flex flex-1 flex-col bg-brand p-6 text-brand-contrast">
                    <p className="font-heading text-xl font-bold leading-snug">{item.title}</p>
                    {item.description && <p className="mt-2 text-sm leading-relaxed whitespace-pre-line opacity-85">{item.description}</p>}
                    {item.href && <Icon name="arrowRight" className="mt-4 size-5 transition group-hover:translate-x-1" />}
                  </div>
                </>
              );
              const box = "group reveal flex h-full flex-col overflow-hidden rounded-[var(--brand-radius)] border border-[var(--line)] shadow-sm transition hover:-translate-y-1 hover:shadow-xl";
              return (
                <li key={`${item.title}-${i}`}>
                  {item.href ? (
                    <a href={item.href} {...(isExternal(item.href) ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={box}>
                      {body}
                    </a>
                  ) : (
                    <div className={box}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : variant === "strip" ? (
          <ul className={`strip-list grid gap-8 sm:grid-cols-2 ${section.items.length >= 5 ? "lg:grid-cols-5" : section.items.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            {section.items.map((item, i) => (
              <li key={`${item.title}-${i}`} className={`group reveal flex gap-4 ${stripLogos ? "flex-col" : ""}`}>
                {(() => {
                  // A sub-brand logo replaces the icon and the title.
                  const mark = resolveImage(ctx, item.image);
                  return mark ? (
                    <Picture image={{ ...mark, alt: mark.alt || item.title }} sizes="200px" className="h-14 w-auto max-w-[11rem] object-contain object-left transition duration-300 group-hover:scale-105" />
                  ) : (
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-brand-contrast shadow-lg shadow-brand/25 transition duration-300 group-hover:scale-110">
                      <Icon name={item.icon ?? "check"} className="size-6" strokeWidth={1.8} />
                    </span>
                  );
                })()}
                <div>
                  <h3 className={item.image ? "sr-only" : "text-sm font-bold uppercase tracking-[0.06em]"}>{item.title}</h3>
                  {item.description && <p className="mt-2 text-sm leading-relaxed text-muted">{item.description}</p>}
                  {item.href && (
                    <a href={item.href} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-text hover:underline">
                      {linkLabel} <Icon name="arrowRight" className="size-4 transition group-hover:translate-x-1" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : variant === "panels" ? (
          <ul className={`panel-grid grid gap-5 sm:grid-cols-2 ${section.items.length % 3 === 0 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
            {section.items.map((item, i) => {
              const image = resolveImage(ctx, item.image);
              const panel = (
                <div className="group reveal relative isolate flex aspect-[4/5] h-full flex-col justify-between overflow-hidden rounded-[var(--brand-radius)] p-8 text-[var(--on-dark)] lg:aspect-[3/4]">
                  {image ? (
                    <Picture image={{ ...image, alt: "" }} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="absolute inset-0 -z-20 h-full w-full object-cover transition duration-[1.2s] ease-out group-hover:scale-110" />
                  ) : (
                    <div aria-hidden className="brand-pattern absolute inset-0 -z-20" />
                  )}
                  <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--dark)_35%,transparent)_0%,color-mix(in_srgb,var(--dark)_10%,transparent)_35%,color-mix(in_srgb,var(--dark)_92%,transparent)_100%)] transition duration-500 group-hover:bg-[color-mix(in_srgb,var(--dark)_78%,transparent)]" />
                  <div className="flex items-center justify-between">
                    <span className="panel-index font-heading text-sm font-semibold tracking-[0.2em]">{String(i + 1).padStart(2, "0")}</span>
                    {item.icon && (
                      <span className="glass flex size-12 items-center justify-center rounded-full border">
                        <Icon name={item.icon} className="size-5" />
                      </span>
                    )}
                  </div>
                  <div>
                    <span aria-hidden className="panel-rule mb-6 block h-px w-12 bg-[var(--brand-bright)] transition-all duration-500 group-hover:w-24" />
                    <h3 className="panel-title font-heading text-3xl font-semibold leading-tight">{item.title}</h3>
                    {item.description && <p className="mt-3 leading-relaxed text-white/80 whitespace-pre-line">{item.description}</p>}
                    {item.href && (
                      <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em]">
                        {linkLabel} <Icon name="arrowRight" className="size-4 transition group-hover:translate-x-1" />
                      </span>
                    )}
                  </div>
                </div>
              );
              return (
                <li key={`${item.title}-${i}`}>
                  {item.href ? (
                    <a href={item.href} {...(isExternal(item.href) ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="block h-full">
                      {panel}
                    </a>
                  ) : (
                    panel
                  )}
                </li>
              );
            })}
          </ul>
        ) : variant === "list" ? (
          <ol className="service-index divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {section.items.map((item, i) => (
              <li key={`${item.title}-${i}`} className="reveal grid gap-4 py-9 sm:grid-cols-[8rem_1fr_auto] sm:items-baseline">
                <span className="font-heading text-4xl font-light text-brand-text">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="flex items-center gap-4 font-heading text-2xl font-semibold">
                    {item.icon && <Icon name={item.icon} strokeWidth={1.5} className="service-index-icon size-8 shrink-0 text-brand-text" />}
                    {item.title}
                  </h3>
                  {item.description && <p className="mt-2 max-w-2xl leading-relaxed text-muted whitespace-pre-line">{item.description}</p>}
                </div>
                {item.href && <ItemLink href={item.href} label={linkLabel} />}
              </li>
            ))}
          </ol>
        ) : (
          <ul className={`services-grid grid gap-6 sm:grid-cols-2 ${section.items.length === 4 || section.items.length === 2 || wideRatio ? "lg:grid-cols-2" : section.items.length === 8 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            {section.items.map((item, i) => {
              const image = variant === "cards" ? resolveImage(ctx, item.image) : null;
              const card = (
                <div
                  className="service-card group reveal flex h-full flex-col overflow-hidden rounded-[var(--brand-radius)] border border-[var(--line)] card-surface transition duration-300 hover:-translate-y-1 hover:shadow-2xl"
                  style={item.accent ? ({ "--item-accent": item.accent } as CSSProperties) : undefined}
                >
                  {variant === "cards" && (
                    <div className="card-media overflow-hidden">
                      {wideRatio ? (
                        // One proportion for the whole row: banners (which carry text) show whole, photos are cropped to match.
                        <div className="relative w-full overflow-hidden" style={{ aspectRatio: wideRatio }}>
                          {image && image.width / image.height > 1.9 ? (
                            <Picture image={image} sizes="(min-width: 1024px) 50vw, 100vw" className="absolute inset-0 h-full w-full object-contain transition duration-700 group-hover:scale-[1.03]" />
                          ) : (
                            <Visual image={image} sizes="(min-width: 1024px) 50vw, 100vw" className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-105" />
                          )}
                        </div>
                      ) : (
                        (section.items.some((it) => it.image) ? <Visual image={image} sizes="(min-width: 1024px) 33vw, 100vw" className="aspect-[16/10] w-full transition duration-700 group-hover:scale-105" /> : null)
                      )}
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-8">
                    {variant === "icons" && (
                      <span className="service-icon mb-7 flex size-14 items-center justify-center rounded-[var(--brand-radius)] bg-brand text-brand-contrast">
                        <Icon name={item.icon ?? "check"} className="size-7" />
                      </span>
                    )}
                    <h3 className="font-heading text-2xl font-semibold">{item.title}</h3>
                    {item.description && <p className="mt-3 flex-1 leading-relaxed text-muted whitespace-pre-line">{item.description}</p>}
                    {item.href && (
                      <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-brand-text">
                        {linkLabel} <Icon name="arrowRight" className="size-4 transition group-hover:translate-x-1" />
                      </span>
                    )}
                  </div>
                </div>
              );
              return (
                <li key={`${item.title}-${i}`}>
                  {item.href ? (
                    <a href={item.href} {...(isExternal(item.href) ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="block h-full">
                      {card}
                    </a>
                  ) : (
                    card
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </SectionShell>
  );
}

/** Large icon: the item's own artwork when it has one, otherwise a line icon on a brand tile. */
function BigIcon({ ctx, image, icon, className = "" }: { ctx: RenderContext; image?: Of<"benefits">["items"][number]["image"]; icon?: Of<"benefits">["items"][number]["icon"]; className?: string }) {
  const art = resolveImage(ctx, image);
  if (art) return <Picture image={{ ...art, alt: "" }} sizes="96px" className={`size-20 object-contain sm:size-24 transition duration-300 ease-out group-hover:-translate-y-1 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:transform-none ${className}`} />;
  return (
    <span className={`icon-tile flex size-20 shrink-0 items-center justify-center rounded-[calc(var(--brand-radius)*1.1)] sm:size-24 transition duration-300 ease-out group-hover:-translate-y-1 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:transform-none ${className}`}>
      <Icon name={icon ?? "check"} strokeWidth={1.9} className="size-12 sm:size-14" />
    </span>
  );
}

export function BenefitsSection({ section, ctx }: { section: Of<"benefits">; ctx: RenderContext }) {
  if (section.variant === "flip") {
    // Cards that turn over on hover or focus: the name and a short text in front, the longer text on the back. Works without JavaScript.
    return (
      <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage}>
        <Container>
          <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} center />
          <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
            {section.items.map((item) => {
              const art = resolveImage(ctx, item.image);
              return (
                <li key={item.title} className="flip-card" tabIndex={0}>
                  <div className="flip-card-inner">
                    <div className="flip-card-face flip-card-front">
                      {art && <Picture image={{ ...art, alt: "" }} sizes="64px" className="mx-auto h-14 w-auto object-contain" />}
                      <h3 className="mt-3 font-heading text-lg font-medium">{item.title}</h3>
                      {item.description && <p className="mt-3 text-sm leading-relaxed text-muted">{item.description}</p>}
                    </div>
                    <div className="flip-card-face flip-card-back">
                      <h3 className="font-heading text-lg font-medium">{item.title}</h3>
                      <p className="mt-3 text-sm leading-relaxed">{item.back || item.description}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Container>
      </SectionShell>
    );
  }
  if (section.variant === "split") {
    // Side by side: the statement (title and intro) on the left, the list beside it, never one under the other on wide screens.
    return (
      <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage}>
        <Container className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
          <div className="benefits-split-lead reveal lg:sticky lg:top-28 lg:self-start">
            <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} className="mb-0" />
            {section.intro && <p className="mt-6 text-xl leading-relaxed text-pretty sm:text-2xl">{section.intro}</p>}
          </div>
          <div className="reveal">
            {section.listTitle && <h3 className="eyebrow mb-6 text-xs font-semibold uppercase tracking-[0.24em] text-brand-text">{section.listTitle}</h3>}
            <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {section.items.map((item) => (
                <li key={item.title} className="flex gap-5 py-6">
                  <BigIcon ctx={ctx} image={item.image} icon={item.icon} className="shrink-0" />
                  <div>
                    <h4 className="text-lg font-semibold leading-snug text-brand-text">{item.title}</h4>
                    {item.description && <p className="mt-1.5 leading-relaxed text-muted">{item.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </SectionShell>
    );
  }
  const list = section.variant === "list";
  const cards = section.variant === "cards";
  return (
    <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage}>
      <Container>
        <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} />
        <ul className={list ? "max-w-3xl space-y-8" : `benefits-grid grid gap-6 sm:grid-cols-2 ${section.items.length === 4 || section.items.length >= 7 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          {section.items.map((item) => (
            <li
              key={item.title}
              className={`group reveal ${cards ? "rounded-[calc(var(--brand-radius)*1.2)] border border-[var(--line)] card-surface p-7 shadow-[0_20px_50px_-20px_color-mix(in_srgb,var(--brand-primary)_45%,transparent)] transition duration-300 hover:-translate-y-1" : ""} ${list ? "flex gap-5" : ""}`}
            >
              <BigIcon ctx={ctx} image={item.image} icon={item.icon} className={list ? "shrink-0" : "mb-6"} />
              <div>
                <h3 className="text-xl font-semibold leading-snug text-brand-text">{item.title}</h3>
                {item.description && <p className="mt-3 leading-relaxed text-muted">{item.description}</p>}
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </SectionShell>
  );
}

export function NumbersSection({ section, ctx }: { section: Of<"numbers">; ctx: RenderContext }) {
  // "split": the claim on the left, a 2-column grid of tinted stat cards on the right.
  if (section.variant === "split") {
    return (
      <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage}>
        <Container className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div>
            <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} className="mb-0" />
            {section.cta && (
              <div className="mt-8">
                <CtaButton ctx={ctx} cta={section.cta} variant="primary" />
              </div>
            )}
          </div>
          <dl className="grid gap-4 sm:grid-cols-2 sm:gap-5">
            {section.items.map((item) => (
              <div key={item.label} className="stat-card reveal flex flex-col-reverse items-center rounded-[calc(var(--brand-radius)*1.2)] border px-6 py-9 text-center">
                <dt className="mt-3 text-base leading-snug text-muted">{item.label}</dt>
                <dd className="flex flex-col items-center">
                  {item.icon && (
                    <span className="stat-chip mb-5 flex size-11 items-center justify-center rounded-[calc(var(--brand-radius)/1.4)]">
                      <Icon name={item.icon} strokeWidth={1.8} className="size-5" />
                    </span>
                  )}
                  <span className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">{item.value}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Container>
      </SectionShell>
    );
  }
  // "cards": white cards with a large icon, as in event and institutional sites.
  if (section.variant === "cards") {
    return (
      <SectionShell id={section.id} tone={toneOf(section, "muted")} ctx={ctx} backdrop={section.backgroundImage}>
        <Container>
          <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} />
          <dl className={`grid gap-5 sm:grid-cols-2 ${section.items.length >= 5 ? "lg:grid-cols-5" : section.items.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            {section.items.map((item) => (
              <div key={item.label} className="group reveal flex flex-col-reverse items-center rounded-[calc(var(--brand-radius)*1.2)] bg-white px-6 py-8 text-center text-[#16181d] shadow-[0_18px_40px_-24px_rgb(0_0_0/0.35)]">
                {/* Label first in markup (dt before dd), shown under the number. */}
                <dt className="mt-2 text-base font-medium text-[#3b4150]">{item.label}</dt>
                <dd className="flex flex-col items-center">
                  {(item.image || item.icon) && <BigIcon ctx={ctx} image={item.image} icon={item.icon} className="mb-6" />}
                  <span className="font-heading text-4xl font-bold tracking-tight text-brand sm:text-5xl">{item.value}</span>
                </dd>
              </div>
            ))}
          </dl>
          {section.cta && (
            <div className="mt-10 flex justify-end">
              <CtaButton ctx={ctx} cta={section.cta} variant="primary" />
            </div>
          )}
        </Container>
      </SectionShell>
    );
  }
  const longValues = section.items.some((item) => item.value.length > 8);
  return (
    <SectionShell id={section.id} tone={toneOf(section, "brand")} ctx={ctx} backdrop={section.backgroundImage} className="numbers-band">
      <Container>
        <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} center className="mb-12" />
        <dl className="numbers-row grid grid-cols-2 lg:grid-flow-col lg:grid-cols-none lg:divide-x lg:divide-[var(--line)]">
          {section.items.map((item) => (
            // justify-end: in a reversed column that is the top, so icons and numbers line up across the row.
            <div key={item.label} className="numbers-item group reveal flex flex-col-reverse items-center justify-end px-6 py-4 text-center">
              {/* Label first in markup (dt before dd), shown under the number. */}
              <dt className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">{item.label}</dt>
              <dd className="flex flex-col items-center">
                {(item.image || item.icon) && <BigIcon ctx={ctx} image={item.image} icon={item.icon} className="mb-5" />}
                {/* A word value ("Sob medida") sets the whole row a size down; on wide screens it stays on one line. */}
                <span className={`numbers-value font-heading font-semibold tracking-tight text-balance lg:whitespace-nowrap ${longValues ? "text-3xl sm:text-4xl xl:text-5xl" : "text-5xl sm:text-6xl"}`}>{item.value}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </SectionShell>
  );
}
