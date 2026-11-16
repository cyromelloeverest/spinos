import type { Section } from "@/lib/sites/content";
import { type RenderContext, resolveImage } from "../context";
import { ui } from "../i18n";
import { Container, CtaButton, Highlighted, Picture, SectionShell, headingTag, toneOf } from "../ui";
import { Countdown } from "./countdown";

type Of<T extends Section["type"]> = Extract<Section, { type: T }>;

/** A campaign opening like a poster: the name across the whole width, the discount huge and a clock to the deadline. */
export function PromoSection({ section, ctx }: { section: Of<"promo">; ctx: RenderContext }) {
  const Heading = headingTag(ctx);
  const t = ui(ctx);
  const image = resolveImage(ctx, section.image);
  const backdrop = Boolean(image || section.backgroundVideo);
  return (
    <SectionShell id={section.id} tone={toneOf(section, "brand")} ctx={ctx} className={`promo overflow-hidden ${backdrop ? "promo-photo" : ""}`}>
      {backdrop && (
        <div aria-hidden className="promo-backdrop">
          {image && <Picture image={{ ...image, alt: "" }} sizes="100vw" priority className="promo-backdrop-media" />}
          {section.backgroundVideo && (
            <video src={section.backgroundVideo} poster={image?.src} autoPlay muted loop playsInline className="promo-backdrop-media" />
          )}
        </div>
      )}
      <Container className="relative">
        {section.eyebrow && <p className="promo-eyebrow">{section.eyebrow}</p>}
        <Heading className="promo-title font-heading">
          <Highlighted ctx={ctx} text={section.heading} highlight={section.highlight} />
        </Heading>
        <div className="promo-grid">
          <p className="promo-discount font-heading" aria-label={[section.discount, section.discountLabel].filter(Boolean).join(" ")}>
            <span aria-hidden>{section.discount}</span>
            {section.discountLabel && <span aria-hidden className="promo-discount-label">{section.discountLabel}</span>}
          </p>
          <div>
            {section.subheading && <p className="promo-sub text-pretty">{section.subheading}</p>}
            {section.deadline && (
              <div className="mt-7">
                {section.deadlineLabel && <p className="promo-eyebrow mb-3">{section.deadlineLabel}</p>}
                <Countdown date={section.deadline} labels={[t.days, t.hours, t.minutes, t.seconds]} endedText={section.endedText} />
              </div>
            )}
            {(section.primaryCta || section.secondaryCta) && (
              <div className="mt-8 flex flex-wrap gap-3">
                {section.primaryCta && <CtaButton ctx={ctx} cta={section.primaryCta} variant="light" />}
                {section.secondaryCta && <CtaButton ctx={ctx} cta={section.secondaryCta} variant="ghost" />}
              </div>
            )}
            {section.terms && <p className="promo-terms">{section.terms}</p>}
          </div>
        </div>
      </Container>
    </SectionShell>
  );
}
