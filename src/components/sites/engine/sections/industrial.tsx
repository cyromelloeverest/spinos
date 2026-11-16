import type { Section } from "@/lib/sites/content";
import { type RenderContext, isExternal, resolveImage } from "../context";
import { Icon } from "../icons";
import { ui } from "../i18n";
import { Container, CtaButton, Eyebrow, Highlighted, Picture, SectionShell, SectionTitle, headingTag, headingWeight, toneOf } from "../ui";

type Of<T extends Section["type"]> = Extract<Section, { type: T }>;
type Model = Of<"models">["models"][number];

const nf = new Intl.NumberFormat("pt-BR");

/** The section's label: a parallelogram tag with the CMYK rule under it. */
function SkewTag({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <div className="mb-6">
      <span className="skew-tag">{children}</span>
      <span aria-hidden className="cmyk-rule" />
    </div>
  );
}

function Meter({ meter }: { meter: NonNullable<Model["meter"]> }) {
  const from = Math.min(meter.from, meter.max);
  const to = Math.min(meter.to, meter.max);
  return (
    <div className="mt-6">
      <div className="relative h-1.5 rounded-full bg-[var(--line)]">
        <div className="range-bar absolute inset-y-0 rounded-full bg-[var(--ink)]" style={{ left: `${(from / meter.max) * 100}%`, width: `${((to - from) / meter.max) * 100}%` }} />
      </div>
      <div className="mono-label mt-2 flex justify-between text-[11px] text-muted">
        <span>0</span>
        <span className="text-[var(--ink)]">{meter.label}</span>
        <span>{nf.format(meter.max)}</span>
      </div>
    </div>
  );
}

function ModelLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      {...(isExternal(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="mono-label mt-5 inline-flex items-center gap-2 text-xs font-medium text-brand-text hover:underline"
    >
      {label} <Icon name="arrowRight" className="size-3.5" />
    </a>
  );
}

/** A product line: cut-out photos on a soft disc beside the line name and its models. */
export function ModelsSection({ section, ctx }: { section: Of<"models">; ctx: RenderContext }) {
  const Heading = headingTag(ctx);
  const head = (
    <>
      <SkewTag>{section.eyebrow}</SkewTag>
      {section.kicker && <p className="mono-label mb-3 text-sm text-muted">{section.kicker}</p>}
      {section.heading && (
        <Heading className={`font-heading text-5xl leading-[1] tracking-tight text-balance sm:text-6xl ${headingWeight(ctx)}`}>
          <Highlighted ctx={ctx} text={section.heading} highlight={section.highlight} />
        </Heading>
      )}
      {section.intro && <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted text-pretty whitespace-pre-line">{section.intro}</p>}
    </>
  );

  if (section.variant === "grid") {
    const n = section.models.length;
    return (
      <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage}>
        <Container>
          <div className="reveal mb-12 max-w-3xl">{head}</div>
          <ul className={`grid border-t border-l border-[var(--line)] ${n % 3 === 0 ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>
            {section.models.map((m) => {
              const img = resolveImage(ctx, m.image);
              return (
                <li key={m.name} id={m.anchor} className="model-card reveal flex scroll-mt-28 flex-col border-r border-b border-[var(--line)] p-7 sm:p-9">
                  {img && (
                    <div className="machine-stage mb-6 flex aspect-[4/3] items-center justify-center">
                      <Picture
                        image={{ ...img, alt: img.alt || m.name }}
                        sizes="(min-width: 1024px) 30vw, 90vw"
                        className="h-full w-auto max-w-[80%] object-contain"
                        // Never wider than the file itself: a small cut-out stays small and sharp instead of stretching.
                        style={{ maxWidth: `min(80%, ${img.width}px)`, maxHeight: `min(86%, ${img.height}px)` }}
                      />
                    </div>
                  )}
                  <h3 className="font-heading text-2xl">{m.name}</h3>
                  {m.description && <p className="mt-3 leading-relaxed text-muted">{m.description}</p>}
                  {m.specs.length > 0 && (
                    <ul className="mt-4 space-y-1.5 text-sm">
                      {m.specs.map((s) => (
                        <li key={s} className="flex gap-2">
                          <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rotate-45 bg-accent" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-auto">
                    {m.meter && <Meter meter={m.meter} />}
                    {m.href && <ModelLink href={m.href} label={section.linkLabel || ui(ctx).techSheet} />}
                  </div>
                </li>
              );
            })}
          </ul>
          {section.cta && (
            <div className="mt-10">
              <CtaButton ctx={ctx} cta={section.cta} variant="primary" />
            </div>
          )}
        </Container>
      </SectionShell>
    );
  }

  const photos = section.images.flatMap((ref) => {
    const p = resolveImage(ctx, ref);
    return p ? [p] : [];
  });
  const imageFirst = section.imageSide === "left";
  return (
    <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage}>
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className={`machine-stage reveal relative ${imageFirst ? "" : "lg:order-2"}`}>
          {photos[0] && <Picture image={{ ...photos[0], alt: photos[0].alt || section.heading || "" }} sizes="(min-width: 1024px) 45vw, 90vw" className="relative w-full" />}
          {photos[1] && (
            <Picture
              image={{ ...photos[1], alt: photos[1].alt || "" }}
              sizes={section.imageLayout === "equal" ? "(min-width: 1024px) 45vw, 90vw" : "(min-width: 1024px) 28vw, 60vw"}
              // Never on top of the first one: below it, with room between them.
              className={`relative mt-8 ${section.imageLayout === "equal" ? "w-full" : "w-[62%]"}`}
            />
          )}
        </div>
        <div className="reveal">
          {head}
          <ul className="mt-9 grid gap-x-10 gap-y-7 sm:grid-cols-2">
            {section.models.map((m) => (
              <li key={m.name}>
                <h3 className="font-heading text-lg uppercase tracking-[0.02em]">{m.name}</h3>
                {m.description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{m.description}</p>}
                <ul className="mt-2.5 space-y-1.5 text-[15px] text-muted">
                  {m.specs.map((s) => (
                    <li key={s} className="flex gap-2.5">
                      <span aria-hidden className="mt-[8px] size-1.5 shrink-0 rotate-45 bg-accent" />
                      {s}
                    </li>
                  ))}
                </ul>
                {m.href && <ModelLink href={m.href} label={section.linkLabel || ui(ctx).techSheet} />}
              </li>
            ))}
          </ul>
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

/** Each row's range on one shared scale, so sizes compare at a glance. */
export function RangesSection({ section, ctx }: { section: Of<"ranges">; ctx: RenderContext }) {
  const color = Object.fromEntries(section.groups.map((g) => [g.id, `c-${g.color}`]));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(section.max * t));
  const pct = (v: number) => `${(Math.min(v, section.max) / section.max) * 100}%`;
  return (
    <SectionShell id={section.id} tone={toneOf(section, "muted")} ctx={ctx} backdrop={section.backgroundImage}>
      <Container>
        <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} className="mb-12 max-w-4xl" />
        <div className="reveal">
          <table className="w-full table-fixed border-collapse">
            <caption className="sr-only">
              {section.heading}: faixas em {section.unit}
            </caption>
            <thead>
              <tr>
                <th scope="col" className="w-32 sm:w-60" />
                <th scope="col" className="relative h-8 border-b border-[var(--ink)] p-0 text-left">
                  {ticks.map((t, i) => (
                    <span key={t} className={`mono-label absolute bottom-2 -translate-x-1/2 text-[11px] text-muted first:translate-x-0 ${i > 0 && i < ticks.length - 1 ? "hidden sm:inline" : ""}`} style={{ left: i === ticks.length - 1 ? undefined : `${(i / (ticks.length - 1)) * 100}%`, right: i === ticks.length - 1 ? 0 : undefined }}>
                      {i === ticks.length - 1 ? `${nf.format(t)} ${section.unit}` : nf.format(t)}
                    </span>
                  ))}
                </th>
              </tr>
            </thead>
            <tbody>
              {section.rows.map((r) => (
                <tr key={`${r.label}-${r.from}`} className="border-b border-[var(--line)]">
                  <th scope="row" className="py-3 pr-4 text-left align-middle">
                    <span className="block font-heading text-sm font-bold uppercase">{r.label}</span>
                    {r.sub && <span className="mono-label block text-[11px] text-muted normal-case tracking-[0.04em]">{r.sub}</span>}
                    {/* On phones the track is narrow: the numbers move under the name. */}
                    <span className="mono-label mt-0.5 block text-[11px] text-[var(--ink)] sm:hidden">
                      {nf.format(r.from)}–{nf.format(r.to)} {section.unit}
                    </span>
                  </th>
                  <td className="range-track relative p-0" style={{ ["--tick" as string]: "25%" }}>
                    <div className="relative h-11">
                      <span className={`range-bar absolute top-1/2 h-3 -translate-y-1/2 ${color[r.group] ?? "c-brand"}`} style={{ left: pct(r.from), width: `calc(${pct(r.to)} - ${pct(r.from)})` }} />
                      <span
                        className="mono-label absolute top-1/2 hidden -translate-y-1/2 text-xs whitespace-nowrap text-[var(--ink)] sm:block"
                        style={r.to / section.max > 0.82 ? { right: `calc(100% - ${pct(r.from)} + 8px)` } : { left: `calc(${pct(r.to)} + 8px)` }}
                      >
                        {nf.format(r.from)}–{nf.format(r.to)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mono-label mt-6 flex flex-wrap gap-x-7 gap-y-2 text-xs text-muted">
          {section.groups.map((g) => (
            <li key={g.id} className="flex items-center gap-2">
              <span aria-hidden className={`inline-block h-2.5 w-5 ${`c-${g.color}`}`} />
              {g.label}
            </li>
          ))}
        </ul>
      </Container>
    </SectionShell>
  );
}

/** Technical sheet: a definition table beside the machine, the optional items as tags below. */
export function SpecsSection({ section, ctx }: { section: Of<"specs">; ctx: RenderContext }) {
  const img = resolveImage(ctx, section.image);
  return (
    <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage}>
      <Container>
        <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} className="mb-12" />
        <div className={`grid gap-12 ${img ? "lg:grid-cols-[1.15fr_0.85fr] lg:items-start" : ""}`}>
          <table className="spec-table reveal w-full border-y border-[var(--ink)] text-left">
            <caption className="sr-only">{ui(ctx).techSpecs}</caption>
            <tbody>
              {section.rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row" className="mono-label w-[38%] py-4 pr-6 align-top text-xs font-medium text-muted">
                    {r.label}
                  </th>
                  <td className="py-4 leading-relaxed">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {img && (
            <div className="machine-stage reveal lg:sticky lg:top-28">
              <Picture image={{ ...img, alt: img.alt || section.heading || "" }} sizes="(min-width: 1024px) 38vw, 90vw" className="w-full" />
            </div>
          )}
        </div>
        {section.optionals.length > 0 && (
          <div className="reveal mt-12">
            <Eyebrow>{ui(ctx).optionals}</Eyebrow>
            <ul className="flex flex-wrap gap-2.5">
              {section.optionals.map((o) => (
                <li key={o} className="rounded-[3px] border border-[var(--line)] px-3.5 py-2 text-sm">
                  {o}
                </li>
              ))}
            </ul>
          </div>
        )}
        {section.cta && (
          <div className="mt-10">
            <CtaButton ctx={ctx} cta={section.cta} variant="primary" />
          </div>
        )}
      </Container>
    </SectionShell>
  );
}
