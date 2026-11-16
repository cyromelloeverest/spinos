import type { CSSProperties } from "react";
import type { ReactNode } from "react";
import type { Section } from "@/lib/sites/content";
import { type RenderContext, resolveImage, whatsappUrl } from "../context";
import { Icon, type UiIconName, WhatsAppGlyph } from "../icons";
import { localHref, ui } from "../i18n";
import { Container, CtaButton, Eyebrow, Highlighted, Picture, SectionShell, SectionTitle, Visual, headingTag, headingWeight, toneOf } from "../ui";

type Of<T extends Section["type"]> = Extract<Section, { type: T }>;

/** "inline": a full-width artwork as it is, the text on the left and the button on the right. */
function CtaInline({ section, ctx }: { section: Extract<Section, { type: "cta" }>; ctx: RenderContext }) {
  const art = resolveImage(ctx, section.image);
  return (
    <section id={section.id} className="cta-inline tone-dark relative isolate overflow-hidden">
      {art && <Picture image={{ ...art, alt: "" }} sizes="100vw" className="absolute inset-0 -z-10 h-full w-full object-cover" />}
      <div aria-hidden className="duotone absolute inset-0 -z-10" />
      <Container className="flex flex-col items-start justify-between gap-8 py-16 md:flex-row md:items-center">
        <div className="max-w-xl">
          <h2 className="font-heading text-3xl leading-tight font-bold text-white">{section.heading}</h2>
          {section.body && <p className="mt-3 text-sm leading-relaxed text-white/90">{section.body}</p>}
        </div>
        <CtaButton ctx={ctx} cta={section.cta} variant="primary" />
      </Container>
    </section>
  );
}

export function CtaSection({ section, ctx }: { section: Of<"cta">; ctx: RenderContext }) {
  if (section.variant === "inline") return <CtaInline section={section} ctx={ctx} />;
  const image = section.variant === "banner" ? null : resolveImage(ctx, section.image);
  const Heading = headingTag(ctx);

  const copy = (
    <div className="reveal">
      <Eyebrow center={section.variant !== "split"}>{section.eyebrow}</Eyebrow>
      <Heading className={`font-heading text-4xl leading-[1.1] tracking-tight text-balance sm:text-5xl ${headingWeight(ctx)}`}>
          <Highlighted ctx={ctx} text={section.heading} highlight={section.highlight} />
        </Heading>
      {section.body && <p className="mt-6 text-lg leading-relaxed text-muted whitespace-pre-line">{section.body}</p>}
      <div className={`mt-10 flex flex-wrap gap-4 ${section.variant === "split" ? "" : "justify-center"}`}>
        <CtaButton ctx={ctx} cta={section.cta} variant="light" />
        {section.secondaryCta && <CtaButton ctx={ctx} cta={section.secondaryCta} variant="ghost" />}
      </div>
    </div>
  );

  // Brand card with a cut-out image shown whole (transparent PNG/WebP) floating gently.
  if (section.variant === "floating") {
    return (
      <section id={section.id} className="tone-light py-[var(--section-py)]">
        <Container>
          <div className="tone-brand relative isolate grid items-center gap-10 overflow-hidden rounded-[calc(var(--brand-radius)*2)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--brand-primary)_70%,black),var(--brand-primary))] px-8 py-12 sm:px-14 lg:grid-cols-2 lg:py-16">
            <div aria-hidden className="absolute -right-24 -bottom-24 -z-10 size-96 rounded-full bg-white/10 blur-3xl" />
            <div className="reveal">
              <Eyebrow>{section.eyebrow}</Eyebrow>
              <Heading className={`font-heading text-4xl leading-[1.1] tracking-tight text-balance sm:text-5xl ${headingWeight(ctx)}`}>
                <Highlighted ctx={ctx} text={section.heading} highlight={section.highlight} />
              </Heading>
              {section.body && <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted whitespace-pre-line">{section.body}</p>}
              <div className="mt-10 flex flex-wrap gap-4">
                <CtaButton ctx={ctx} cta={section.cta} variant="light" />
                {section.secondaryCta && <CtaButton ctx={ctx} cta={section.secondaryCta} variant="ghost" />}
              </div>
            </div>
            {image && (
              <div className="float-soft mx-auto w-full max-w-lg">
                <Picture image={image} sizes="(min-width: 1024px) 40vw, 90vw" className="h-auto w-full object-contain drop-shadow-[0_30px_40px_rgb(0_0_0/0.35)]" />
              </div>
            )}
          </div>
        </Container>
      </section>
    );
  }

  // Photo behind a dark veil, text centered: the closing band of a premium page.
  if (section.variant === "image") {
    return (
      <section id={section.id} className="tone-dark relative isolate overflow-hidden py-32">
        {image ? (
          <Picture image={image} sizes="100vw" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        ) : (
          <div aria-hidden className="brand-pattern absolute inset-0 -z-20" />
        )}
        <div aria-hidden className="absolute inset-0 -z-10 bg-[color-mix(in_srgb,var(--dark)_78%,transparent)]" />
        <Container className="max-w-3xl text-center">{copy}</Container>
      </section>
    );
  }

  if (section.variant === "split") {
    return (
      <SectionShell id={section.id} tone={toneOf(section, "brand")} ctx={ctx} backdrop={section.backgroundImage}>
        <Container className="grid items-center gap-14 lg:grid-cols-2">
          {copy}
          <Visual image={image} sizes="(min-width: 1024px) 50vw, 100vw" className="aspect-[4/3] w-full rounded-[var(--brand-radius)] shadow-2xl" />
        </Container>
      </SectionShell>
    );
  }

  return (
    <SectionShell id={section.id} tone={toneOf(section, "brand")} ctx={ctx} backdrop={section.backgroundImage}>
      <Container className="max-w-3xl text-center">{copy}</Container>
    </SectionShell>
  );
}

const field =
  "mt-2 block w-full rounded-[var(--brand-radius)] border border-[#d8dbe1] bg-white px-4 py-3.5 text-[#16181d] outline-none transition placeholder:text-[#8a909c] focus:border-brand focus:ring-4 focus:ring-brand/15";

function InfoRow({ icon, children }: { icon: UiIconName | "phone" | "clock" | "whatsapp"; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-brand-text">
        {icon === "whatsapp" ? <WhatsAppGlyph className="size-5" /> : <Icon name={icon} className="size-5" />}
      </span>
      <span className="pt-2.5 leading-relaxed">{children}</span>
    </li>
  );
}

/**
 * Plain HTML form posting to the site's own /api/lead: works with JavaScript
 * disabled. Origin page and UTM tags are read server-side from the Referer.
 */
export type LeadStatus = "sent" | "error" | undefined;

export function ContactSection({ section, ctx, status }: { section: Of<"contact">; ctx: RenderContext; status?: LeadStatus }) {
  const { business } = ctx.site;
  const showInfo = section.variant === "form-and-info";
  const address = business.address;
  const local = (digits: string) => (digits.startsWith("55") ? digits.slice(2) : digits);
  const sameNumber = Boolean(business.phone && business.whatsapp && local(business.phone) === local(business.whatsapp.number));
  return (
    <SectionShell id={section.id} tone={toneOf(section, "dark")} ctx={ctx} backdrop={section.backgroundImage} className={section.pattern ? "relative isolate overflow-hidden" : ""}>
      {resolveImage(ctx, section.pattern) && <Picture image={{ ...resolveImage(ctx, section.pattern)!, alt: "" }} sizes="100vw" className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover" />}
      <Container className={`grid gap-14 ${showInfo ? "lg:grid-cols-[2fr_3fr]" : "contact-form-only max-w-3xl"}`}>
        <div className="reveal">
          <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading ?? ui(ctx).contactUs} highlight={section.highlight} intro={section.intro} className="mb-10" />
          {showInfo && !section.hideContacts && (
            <ul className="space-y-5">
              {business.whatsapp && !sameNumber && (
                <InfoRow icon="whatsapp">
                  <a className="font-semibold hover:text-brand-text" href={whatsappUrl(business.whatsapp.number, business.whatsapp.defaultMessage)} target="_blank" rel="noopener noreferrer">
                    WhatsApp {formatPhone(business.whatsapp.number)}
                  </a>
                </InfoRow>
              )}
              {business.phone && (
                <InfoRow icon="phone">
                  <a className="hover:text-brand-text" href={telHref(business.phone)}>
                    {formatPhone(business.phone)}
                  </a>
                  {/* One line when the landline also takes WhatsApp. */}
                  {sameNumber && business.whatsapp && (
                    <>
                      {" · "}
                      <a className="font-semibold hover:text-brand-text" href={whatsappUrl(business.whatsapp.number, business.whatsapp.defaultMessage)} target="_blank" rel="noopener noreferrer">
                        WhatsApp
                      </a>
                    </>
                  )}
                </InfoRow>
              )}
              {business.email && (
                <InfoRow icon="mail">
                  <a className="hover:text-brand-text" href={`mailto:${business.email}`}>
                    {business.email}
                  </a>
                </InfoRow>
              )}
              {address && !section.hideAddress && (
                <InfoRow icon="mapPin">
                  <span className="text-muted">
                    {address.street && <>{address.street}<br /></>}
                    {address.city} – {address.state}
                    {address.postalCode && `, ${address.postalCode}`}
                  </span>
                </InfoRow>
              )}
              {business.openingHours && (
                <InfoRow icon="clock">
                  <span className="text-muted">{business.openingHours}</span>
                </InfoRow>
              )}
            </ul>
          )}
        </div>

        {/*
          * Message and form are both in the page and the browser shows the right one
          * (?enviado / ?erro after the post): the page itself stays cacheable.
          */}
        <div className="reveal" data-lead-box={section.id}>
          <p role="status" data-lead-sent hidden={status !== "sent"} className="rounded-[var(--brand-radius)] bg-white p-10 text-lg font-medium text-[#16181d] shadow-2xl">
            {section.successMessage}
          </p>
          <form method="post" action="/api/lead" hidden={status === "sent"} className="grid gap-5 rounded-[var(--brand-radius)] bg-white p-8 text-[#16181d] shadow-2xl sm:grid-cols-2 sm:p-10">
              <input type="hidden" name="page" value={ctx.pagePath} />
              <input type="hidden" name="section" value={section.id} />
              {/* Filled by the interactive tools on the page (diagnóstico, calculadora…). */}
              <input type="hidden" name="context" defaultValue="" />
              {/* Honeypot: invisible to people, irresistible to bots. */}
              {/* "ts": page-open time, written by the browser; the spam filter reads how long the form took. */}
              <input type="hidden" name="ts" />
              {/* "attr": the ad click that brought the visitor (gclid, fbclid…), written by the browser. */}
              <input type="hidden" name="attr" />
              <div aria-hidden className="absolute -left-[9999px]">
                <label>
                  Site <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              <p role="alert" data-lead-error hidden={status !== "error"} className="rounded-[var(--brand-radius)] border border-red-300 bg-red-50 px-4 py-3 text-red-800 sm:col-span-2">
                {ui(ctx).sendError}
              </p>
              {section.anonymous && <p className="text-sm text-[#5b6270] sm:col-span-2">{ui(ctx).anonymousNote}</p>}
              <label className="sm:col-span-2">
                <span className="text-sm font-semibold">{section.anonymous ? ui(ctx).nameOptional : ui(ctx).nameRequired}</span>
                <input className={field} name="name" required={!section.anonymous} maxLength={120} autoComplete={section.anonymous ? "off" : "name"} />
              </label>
              {section.fields.company && !section.requireEmailAndCompany && (
                <label className="sm:col-span-2">
                  <span className="text-sm font-semibold">{ui(ctx).company}</span>
                  <input className={field} name="company" required={section.requireEmailAndCompany} maxLength={120} autoComplete="organization" />
                </label>
              )}
              {section.fields.phone && (
                <label>
                  <span className="text-sm font-semibold">{ui(ctx).phoneWhatsapp}</span>
                  <input className={field} name="phone" type="tel" maxLength={30} autoComplete="tel" />
                </label>
              )}
              {section.fields.email && (
                <label className={section.fields.phone ? "" : "sm:col-span-2"}>
                  <span className="text-sm font-semibold">{ui(ctx).email}{section.requireEmailAndCompany && " *"}</span>
                  <input className={field} name="email" type="email" required={section.requireEmailAndCompany} maxLength={200} autoComplete="email" />
                </label>
              )}
              {section.fields.company && section.requireEmailAndCompany && (
                <label className="sm:col-span-2">
                  <span className="text-sm font-semibold">{ui(ctx).company} *</span>
                  <input className={field} name="company" required={section.requireEmailAndCompany} maxLength={120} autoComplete="organization" />
                </label>
              )}
              {section.extraFields.map((f) => (
                <label key={f.name} className="sm:col-span-2">
                  <span className="text-sm font-semibold">{f.label}{f.required && " *"}</span>
                  <input className={field} name={`extra_${f.name}`} required={f.required} maxLength={200} />
                </label>
              ))}
              {section.fields.message && (
                <label className="sm:col-span-2">
                  <span className="text-sm font-semibold">{section.messageLabel || ui(ctx).message}</span>
                  <textarea className={`${field} min-h-32`} name="message" maxLength={2000} placeholder={section.messagePlaceholder || undefined} />
                </label>
              )}
              <p className="text-sm text-[#5b6270] sm:col-span-2">
                {ui(ctx).consentBefore}{" "}
                <a className="underline" href={localHref(ctx, "/privacidade")}>
                  {ui(ctx).privacyPolicy}
                </a>
                {ui(ctx).policyEnd}
              </p>
              <button
                type="submit"
                className="group inline-flex min-h-13 items-center justify-center gap-3 rounded-[var(--button-radius)] bg-[var(--brand-on-white)] px-7 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--brand-on-white-text)] transition hover:brightness-110 sm:col-span-2"
              >
                {section.submitLabel || ui(ctx).send}
                <Icon name="arrowRight" className="size-4 transition group-hover:translate-x-1" />
              </button>
              {section.formNote && <p className="text-xs text-[#5b6270] sm:col-span-2">{section.formNote}</p>}
            </form>
        </div>
      </Container>
    </SectionShell>
  );
}

/** Link to Google Maps instead of an embedded map: the embed alone costs ~500 KB of JavaScript. */
export function MapSection({ section, ctx }: { section: Of<"map">; ctx: RenderContext }) {
  const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(section.query)}`;
  const address = ctx.site.business.address;
  const Heading = headingTag(ctx);
  return (
    <SectionShell id={section.id} tone={toneOf(section, "light")} ctx={ctx} backdrop={section.backgroundImage} className="!py-16">
      <Container>
        <div className="flex flex-col items-start justify-between gap-6 rounded-[var(--brand-radius)] border border-[var(--line)] p-8 sm:flex-row sm:items-center sm:p-10">
          <div className="flex gap-5">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-brand-contrast">
              <Icon name="mapPin" className="size-6" />
            </span>
            <div>
              <Heading className="font-heading text-2xl font-semibold">{section.heading ?? ui(ctx).howToGet}</Heading>
              <p className="mt-1 text-muted">
                {section.variant === "with-address" && address ? [address.street, `${address.city} – ${address.state}`].filter(Boolean).join(", ") : section.query}
              </p>
            </div>
          </div>
          <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-[var(--button-radius)] border border-current/30 px-6 text-sm font-semibold uppercase tracking-[0.12em] hover:border-current">
            {ui(ctx).openMaps} <Icon name="arrowRight" className="size-4" />
          </a>
        </div>
        {section.variant === "embed" && (
          <iframe
            src={`https://www.google.com/maps?q=${encodeURIComponent(section.query)}&output=embed`}
            title={section.heading ?? ui(ctx).howToGet}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="map-embed mt-6 aspect-[4/3] w-full rounded-[var(--brand-radius)] border border-[var(--line)] sm:aspect-[21/9]"
          />
        )}
      </Container>
    </SectionShell>
  );
}

/**
 * Toll-free and special numbers (0800, 0300…) are dialled as they are, without DDD or country code. WhatsApp stores
 * them without the leading 0 (55 800…), so both spellings are recognised.
 */
export function specialNumber(digits: string): string | null {
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  const m = local.match(/^0?([3589]00\d{7})$/);
  return m ? `0${m[1]}` : null;
}

/** The tel: link of a stored phone (digits, usually with the 55 country code). */
export function telHref(digits: string): string {
  const special = specialNumber(digits);
  if (special) return `tel:${special}`;
  return `tel:+55${digits.startsWith("55") ? digits.slice(2) : digits}`;
}

export function formatPhone(digits: string): string {
  const special = specialNumber(digits);
  if (special) return `${special.slice(0, 4)} ${special.slice(4, 7)} ${special.slice(7)}`;
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  const ddd = local.slice(0, 2);
  const rest = local.slice(2);
  return rest.length === 9 ? `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}` : `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

/** Name + e-mail sign-up for a newsletter or a waiting list. Posts to the same lead endpoint as the contact form. */
export function NewsletterSection({ section, ctx, status }: { section: Of<"newsletter">; ctx: RenderContext; status?: LeadStatus }) {
  const image = resolveImage(ctx, section.image);
  const card = section.variant === "card";
  const product = section.variant === "product";
  const cols = section.emailOnly ? "sm:grid-cols-[1fr_auto]" : "sm:grid-cols-[1fr_1.3fr_auto]";
  const form = (
    <div data-lead-box={section.id}>
      <p role="status" data-lead-sent hidden={status !== "sent"} className="newsletter-sent rounded-[var(--brand-radius)] bg-white p-8 text-lg font-medium text-[#16181d] shadow-2xl">
        {section.successMessage}
      </p>
      <form method="post" action="/api/lead" hidden={status === "sent"} className={`newsletter-form grid gap-3 ${product ? "" : cols}`}>
        <input type="hidden" name="page" value={ctx.pagePath} />
        <input type="hidden" name="section" value={section.id} />
        <input type="hidden" name="intent" value={section.intent} />
        {/* "ts": page-open time, written by the browser; the spam filter reads how long the form took. */}
        <input type="hidden" name="ts" />
        {/* "attr": the ad click that brought the visitor (gclid, fbclid…), written by the browser. */}
        <input type="hidden" name="attr" />
        <div aria-hidden className="absolute -left-[9999px]">
          <label>
            Site <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        {!section.emailOnly && (
          <>
            <label className="sr-only" htmlFor={`${section.id}-name`}>{ui(ctx).name}</label>
            <input id={`${section.id}-name`} className={`${field} mt-0 h-12 py-0`} name="name" required maxLength={120} autoComplete="given-name" placeholder={ui(ctx).yourName} />
          </>
        )}
        <label className="sr-only" htmlFor={`${section.id}-email`}>{ui(ctx).email}</label>
        <input id={`${section.id}-email`} className={`${field} mt-0 h-12 py-0`} name="email" type="email" required maxLength={200} autoComplete="email" placeholder={ui(ctx).yourEmail} />
        {section.consentText && (
          <label className={`newsletter-consent flex items-start gap-2.5 text-sm leading-snug ${product ? "" : "sm:col-span-full sm:order-last"}`}>
            <input type="checkbox" name="consent" required className="mt-0.5 size-4 shrink-0 accent-[var(--brand-primary)]" />
            <span>{section.consentText}</span>
          </label>
        )}
        <button type="submit" className="group inline-flex h-12 items-center justify-center gap-2 rounded-[var(--button-radius)] bg-brand px-6 text-xs font-semibold uppercase tracking-[0.12em] whitespace-nowrap text-brand-contrast transition hover:brightness-110">
          {section.buttonLabel}
          <Icon name="arrowRight" className="size-4 transition group-hover:translate-x-1" />
        </button>
        <p role="alert" data-lead-error hidden={status !== "error"} className="text-sm font-medium text-red-300 sm:col-span-full">{ui(ctx).newsletterError}</p>
        <p className="text-xs text-muted sm:col-span-full sm:order-last">
          {section.consentText ? null : `${ui(ctx).noSpam} `}
          <a className="underline" href={localHref(ctx, "/privacidade")}>{ui(ctx).privacyPolicy}</a>
          {section.consentText ? null : ui(ctx).policyEnd}
        </p>
      </form>
    </div>
  );
  if (product) {
    return (
      <SectionShell id={section.id} tone={toneOf(section, "muted")} ctx={ctx} backdrop={section.backgroundImage}>
        <Container className="newsletter-product grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          {image && (
            <figure className={`product-visual reveal m-0 justify-self-center ${section.imageFrame === "none" ? "product-visual-free" : ""}`}>
              <Picture image={image} sizes="(min-width: 1024px) 520px, 92vw" className="block h-auto w-full" />
              {section.imageCaption && <figcaption className="px-4 py-2 text-sm font-semibold text-muted">{section.imageCaption}</figcaption>}
            </figure>
          )}
          {/* Phones: the card with the form comes first, so a link to this block lands on the form, not on the picture. */}
          <div className="product-panel reveal relative grid gap-5 max-lg:order-first rounded-[var(--brand-radius)] bg-white p-7 text-[#16181d] shadow-xl sm:p-9">
            {section.badge && <span className="product-badge justify-self-start">{section.badge}</span>}
            <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading ?? ui(ctx).newsletterTitle} highlight={section.highlight} intro={section.body} />
            {section.features.length > 0 && (
              <ul className="product-features grid gap-2.5">
                {section.features.map((f) => (
                  <li key={f} className="flex gap-3">
                    <Icon name="check" className="mt-1 size-5 shrink-0 text-brand-text" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
            {(section.price || section.priceNote) && (
              <p className="product-price flex flex-wrap items-baseline gap-x-3 border-t border-[var(--line)] pt-4">
                {section.price && <strong className="font-heading text-4xl font-semibold">{section.price}</strong>}
                {section.priceNote && <span className="text-sm text-muted">{section.priceNote}</span>}
              </p>
            )}
            {section.buyCta ? (
              <div className="product-buy [&>a]:w-full">
                <CtaButton ctx={ctx} cta={section.buyCta} variant="primary" />
              </div>
            ) : (
              form
            )}
          </div>
        </Container>
      </SectionShell>
    );
  }
  return (
    <SectionShell id={section.id} tone={toneOf(section, "dark")} ctx={ctx} backdrop={section.backgroundImage}>
      <Container className={card || image ? "grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]" : "max-w-4xl"}>
        <div className="reveal">
          <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading ?? ui(ctx).newsletterTitle} highlight={section.highlight} intro={section.body} className="mb-8" />
          {form}
        </div>
        {image && <Visual image={image} sizes="(min-width: 1024px) 40vw, 100vw" className="aspect-[4/5] w-full rounded-[var(--brand-radius)] shadow-2xl lg:aspect-[4/5]" />}
      </Container>
    </SectionShell>
  );
}

/** Purchase options side by side; the product sits on a lit panel, the button closes each card. */
export function OffersSection({ section, ctx }: { section: Of<"offers">; ctx: RenderContext }) {
  const n = section.items.length;
  return (
    <SectionShell id={section.id} tone={toneOf(section, "muted")} ctx={ctx} backdrop={section.backgroundImage}>
      <Container>
        <SectionTitle ctx={ctx} eyebrow={section.eyebrow} title={section.heading} highlight={section.highlight} intro={section.intro} center />
        <ul className={`mx-auto grid gap-6 ${n === 1 ? "max-w-md" : n === 2 ? "max-w-4xl sm:grid-cols-2" : n === 3 ? "lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
          {section.items.map((item) => {
            const image = resolveImage(ctx, item.image);
            return (
              <li key={item.title} className={`offer-card reveal relative flex flex-col overflow-hidden rounded-[calc(var(--brand-radius)*1.2)] border ${item.badge ? "offer-featured" : ""}`} style={item.accent ? ({ "--item-accent": item.accent } as CSSProperties) : undefined}>
                {item.badge && (
                  <span className="absolute top-4 right-4 z-10 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-contrast">{item.badge}</span>
                )}
                {image && (
                  <div className="lead-panel relative aspect-[4/3]">
                    <Picture image={{ ...image, alt: image.alt || item.title }} sizes="(min-width: 640px) 420px, 90vw" className="absolute inset-0 m-auto h-[80%] w-[80%] object-contain drop-shadow-[0_24px_30px_rgb(0_0_0/0.45)]" />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-7">
                  {item.icon && (
                    <span className="mb-6 inline-flex size-20 items-center justify-center self-start rounded-[var(--brand-radius)] bg-brand text-brand-contrast">
                      <Icon name={item.icon} className="size-10" strokeWidth={1.75} />
                    </span>
                  )}
                  <h3 className="font-heading text-2xl font-semibold">{item.title}</h3>
                  {item.price && <p className="mt-3 font-heading text-4xl font-semibold tracking-tight">{item.price}</p>}
                  {item.note && <p className="mt-1 text-sm text-muted">{item.note}</p>}
                  {item.description && <p className={`mt-4 leading-relaxed text-muted ${item.features.length ? "" : "flex-1"}`}>{item.description}</p>}
                  {item.features.length > 0 && (
                    <ul className="offer-features mt-5 flex-1 space-y-2.5 border-t border-[var(--line)] pt-5 text-sm">
                      {item.features.map((f) => (
                        <li key={f} className="flex gap-2.5">
                          <Icon name="check" className="mt-0.5 size-4 shrink-0 text-brand-text" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-7 [&>a]:w-full">
                    <CtaButton ctx={ctx} cta={item.cta} variant="primary" />
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
