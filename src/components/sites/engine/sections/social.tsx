import type { Section } from "@/lib/sites/content";
import { ui } from "../i18n";
import { type RenderContext, resolveImage } from "../context";
import { Container, CtaButton, Picture, SectionShell, SectionTitle, toneOf } from "../ui";

type Of<T extends Section["type"]> = Extract<Section, { type: T }>;

export function TestimonialsSection({ section, ctx }: { section: Of<"testimonials">; ctx: RenderContext }) {
  // Carousel is pure CSS scroll-snap: swipeable on phones, no JavaScript shipped.
  const carousel = section.variant === "carousel";
  // "split": the claim and a button on the left, a row of quotes that peeks past the edge on the right.
  if (section.variant === "split") {
    return (
      <SectionShell id={section.id} tone={toneOf(section, "dark")} ctx={ctx} backdrop={section.backgroundImage} className="overflow-hidden">
        <Container className="grid items-center gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} className="mb-0" />
            {section.cta && (
              <div className="mt-8">
                <CtaButton ctx={ctx} cta={section.cta} variant="primary" />
              </div>
            )}
          </div>
          <ul className="-mr-5 flex snap-x snap-mandatory gap-5 overflow-x-auto pr-5 pb-5 [scrollbar-color:var(--brand-text)_transparent] [scrollbar-width:thin] sm:-mr-8 sm:pr-8 lg:mr-[calc(min(0px,(80rem_-_100vw)/2)_-_2rem)]" aria-label={ui(ctx).testimonials}>
            {section.items.map((t, i) => {
              const photo = resolveImage(ctx, t.photo);
              return (
                <li key={i} className="w-[86%] shrink-0 snap-start sm:w-[62%] lg:w-[68%]">
                  <figure className="quote-card flex h-full flex-col rounded-[calc(var(--brand-radius)*1.2)] border p-7 sm:p-8">
                    <figcaption className="flex items-center gap-3">
                      {photo && <Picture image={photo} sizes="56px" className="size-14 rounded-full object-cover" />}
                      <span>
                        <span className="block text-lg font-semibold text-brand-text">{t.author}</span>
                        {t.role && <span className="block text-sm text-muted">{t.role}</span>}
                      </span>
                    </figcaption>
                    <blockquote className="mt-5 flex-1 leading-relaxed whitespace-pre-line">{t.quote}</blockquote>
                  </figure>
                </li>
              );
            })}
          </ul>
        </Container>
      </SectionShell>
    );
  }
  return (
    <SectionShell id={section.id} tone={toneOf(section, "muted")} ctx={ctx} backdrop={section.backgroundImage}>
      <Container>
        <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} />
        <ul className={carousel ? "-mx-5 flex snap-x snap-mandatory gap-6 overflow-x-auto px-5 pb-4" : "grid gap-6 md:grid-cols-2 lg:grid-cols-3"}>
          {section.items.map((t, i) => {
            const photo = resolveImage(ctx, t.photo);
            return (
              <li key={i} className={`reveal ${carousel ? "w-[85%] shrink-0 snap-start sm:w-[45%] lg:w-[32%]" : ""}`}>
                <figure className="flex h-full flex-col rounded-[var(--brand-radius)] border border-[var(--line)] card-surface p-8">
                  <span aria-hidden className="quote-mark font-heading text-6xl leading-none text-brand-text">“</span>
                  <blockquote className="mt-2 flex-1 text-lg leading-relaxed whitespace-pre-line">{t.quote}</blockquote>
                  <figcaption className="mt-8 flex items-center gap-3 border-t border-[var(--line)] pt-6">
                    {photo && <Picture image={photo} sizes="48px" className="size-12 rounded-full object-cover" />}
                    <span>
                      <span className="block font-semibold">{t.author}</span>
                      {t.role && <span className="block text-sm text-muted">{t.role}</span>}
                    </span>
                  </figcaption>
                </figure>
              </li>
            );
          })}
        </ul>
      </Container>
    </SectionShell>
  );
}

export function ClientsSection({ section, ctx }: { section: Of<"clients">; ctx: RenderContext }) {
  const logos = section.logos.map((l) => ({ ...l, image: resolveImage(ctx, l.logo) }));
  if (logos.length === 0) return null;
  // A company whose logo has not arrived yet keeps its place: its name, set in the heading font.
  const nameMark = (name: string, className = "") => <span className={`font-heading text-lg font-semibold leading-tight text-balance text-center ${className}`}>{name}</span>;
  // Official seals keep their artwork untouched: own colors, full opacity, one common height.
  if (section.variant === "badges") {
    return (
      <SectionShell id={section.id} tone={toneOf(section, "dark")} ctx={ctx} backdrop={section.backgroundImage} className="!py-16">
        <Container>
          <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} center className="mb-10" />
          <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-8">
            {logos.map((l) => {
              // Square seals (Google's) carry more inner margin than wide ones: a little taller keeps them at the same visual weight.
              if (!l.image)
                return (
                  <li key={l.name} className="reveal">
                    <span className="flex h-20 w-36 items-center justify-center rounded-xl bg-white p-3 text-[#16181d] sm:h-24 sm:w-[10.5rem]">{nameMark(l.name, "text-base")}</span>
                  </li>
                );
              const square = l.image.width / l.image.height < 1.5;
              const img = (
                <Picture
                  image={{ ...l.image, alt: l.image.alt || l.name }}
                  sizes="320px"
                  className={`w-auto max-w-72 rounded-xl object-contain ${square ? "h-28 sm:h-32" : "h-20 sm:h-24"}`}
                />
              );
              return (
                <li key={l.name} className="reveal">
                  {l.href ? (
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className="block transition hover:-translate-y-0.5">
                      {img}
                    </a>
                  ) : (
                    img
                  )}
                </li>
              );
            })}
          </ul>
        </Container>
      </SectionShell>
    );
  }
  if (section.variant === "directory") {
    return (
      <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage}>
        <Container>
          <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} className="mb-10" />
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {logos.map((l) => {
              const inner = (
                <>
                  <span className="flex aspect-[16/10] w-full items-center justify-center bg-white p-4">
                    {l.image ? <Picture image={{ ...l.image, alt: l.image.alt || l.name }} sizes="(min-width: 1024px) 220px, 45vw" className="max-h-full w-auto max-w-full object-contain" /> : nameMark(l.name, "text-base text-[#16181d]")}
                  </span>
                  <span className="block border-t border-[var(--line)] px-3 py-3">
                    <span className="block text-sm leading-snug font-semibold">{l.name}</span>
                    {l.note && <span className="mt-1 block text-xs leading-snug text-muted">{l.note}</span>}
                  </span>
                </>
              );
              const box = "block h-full overflow-hidden rounded-[var(--brand-radius)] border border-[var(--line)] bg-white text-[#16181d]";
              return (
                <li key={l.name} className="min-w-0">
                  {l.href ? (
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className={`${box} transition hover:-translate-y-0.5 hover:shadow-lg`}>{inner}</a>
                  ) : (
                    <div className={box}>{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Container>
      </SectionShell>
    );
  }
  // "sponsors": every sponsor in the same large 16:9 rectangle, centred rows, white tiles.
  if (section.variant === "sponsors") {
    return (
      <SectionShell id={section.id} tone={toneOf(section, "muted")} ctx={ctx} backdrop={section.backgroundImage}>
        <Container>
          <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} center className="mb-12" />
          <ul className="flex flex-wrap justify-center gap-4 sm:gap-6">
            {logos.map((l) => {
              // A logo already prepared at 16:9 (with its margin) fills the tile; any other gets breathing room.
              const wide = l.image && Math.abs(l.image.width / l.image.height - 16 / 9) < 0.08;
              const mark = l.image ? (
                <Picture image={{ ...l.image, alt: l.image.alt || l.name }} sizes="(min-width: 1024px) 300px, 50vw" className={`absolute inset-0 h-full w-full object-contain ${wide ? "" : "p-[12%]"}`} />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center p-3 sm:p-6">{nameMark(l.name, "text-sm text-[#16181d] sm:text-xl lg:text-2xl")}</span>
              );
              return (
                <li key={l.name} className="sponsor-tile reveal relative aspect-video w-[calc(50%-0.5rem)] overflow-hidden rounded-[var(--brand-radius)] bg-white shadow-lg shadow-black/10 ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:w-[calc(33.333%-1rem)] lg:w-[calc(25%-1.125rem)]">
                  {l.href ? (
                    <a href={l.href} target="_blank" rel="noopener noreferrer" aria-label={l.name} className="absolute inset-0">
                      {mark}
                    </a>
                  ) : (
                    mark
                  )}
                </li>
              );
            })}
          </ul>
        </Container>
      </SectionShell>
    );
  }
  // "strip": light logos straight on a dark band, no tiles (client marks, partner badges).
  if (section.variant === "strip") {
    return (
      <SectionShell id={section.id} tone={toneOf(section, "dark")} ctx={ctx} backdrop={section.backgroundImage} className="!py-14">
        <Container>
          <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} center className="mb-10" />
          <ul className="logo-strip flex flex-wrap items-center justify-center gap-x-12 gap-y-8 sm:gap-x-16">
            {logos.map((l) => {
              const img = l.image ? <Picture image={{ ...l.image, alt: l.image.alt || l.name }} sizes="200px" className="h-11 w-auto max-w-44 object-contain opacity-75 transition duration-300 hover:opacity-100 sm:h-12" /> : nameMark(l.name, "opacity-75");
              return (
                <li key={l.name} className="reveal">
                  {l.href ? (
                    <a href={l.href} target="_blank" rel="noopener noreferrer">
                      {img}
                    </a>
                  ) : (
                    img
                  )}
                </li>
              );
            })}
          </ul>
        </Container>
      </SectionShell>
    );
  }
  return (
    <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage} className="!py-16">
      <Container>
        <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} center className="mb-10" />
        <ul className="flex flex-wrap items-center justify-center gap-4">
          {logos.map((l) => {
            const img = l.image ? (
              <Picture
                image={{ ...l.image, alt: l.image.alt || l.name }}
                sizes="160px"
                className={`h-20 w-auto max-w-40 object-contain ${section.variant === "logos-grayscale" ? "opacity-60 grayscale transition hover:opacity-100 hover:grayscale-0" : ""}`}
              />
            ) : (
              nameMark(l.name, "text-[#16181d]")
            );
            return (
              // Same white tile for every logo: brand files arrive with all kinds of backgrounds and proportions.
              <li key={l.name} className="logo-tile reveal flex h-28 w-48 items-center justify-center rounded-[var(--brand-radius)] border border-[var(--line)] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
                {l.href ? (
                  <a href={l.href} target="_blank" rel="noopener noreferrer">
                    {img}
                  </a>
                ) : (
                  img
                )}
              </li>
            );
          })}
        </ul>
      </Container>
    </SectionShell>
  );
}

export function FaqSection({ section, ctx }: { section: Of<"faq">; ctx: RenderContext }) {
  // Native <details>: accessible, works without JavaScript, and Google reads the answers.
  const items = (
    <div>
      {section.items.map((item) => (
        <details key={item.question} className="group border-b border-[var(--line)] py-6 first:border-t">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-heading text-lg font-semibold">
            {item.question}
            <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-brand-text transition group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="mt-4 max-w-3xl leading-relaxed text-muted whitespace-pre-line">{item.answer}</p>
        </details>
      ))}
    </div>
  );
  return (
    <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage}>
      <Container>
        {section.variant === "two-columns" ? (
          <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading ?? ui(ctx).faq} highlight={section.highlight} className="mb-0" />
            </div>
            {items}
          </div>
        ) : (
          <div className="mx-auto max-w-4xl">
            <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading ?? ui(ctx).faq} highlight={section.highlight} />
            {items}
          </div>
        )}
      </Container>
    </SectionShell>
  );
}
