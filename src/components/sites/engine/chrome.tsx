import { Fragment } from "react";
import { contactHref } from "./blog";
import { EXTRA_LOCALES, type Locale, MAIN_LOCALE } from "@/lib/sites/content";
import { type RenderContext, ctaHref, isExternal, resolveImage, whatsappUrl } from "./context";
import { localHref, localeLabel, localePrefix, ui } from "./i18n";
import { Icon, SocialIcon, WhatsAppGlyph } from "./icons";
import { formatPhone, telHref } from "./sections/conversion";
import { Container, Picture } from "./ui";

/** Platform signature in every site's footer. */
const SPINOS_URL = "https://spinos.com.br/?utm_source=site-cliente&utm_medium=assinatura";

function pageHref(ctx: RenderContext, slug: string) {
  return localHref(ctx, slug === "" ? "/" : `/${slug}`);
}

/** A menu item is current on its own page and on everything under it (e.g. articles under /insights). */
function isCurrent(ctx: RenderContext, slug: string): boolean {
  const href = pageHref(ctx, slug);
  return href === pageHref(ctx, "") ? ctx.pagePath === href : ctx.pagePath === href || ctx.pagePath.startsWith(`${href}/`);
}

/** The page being shown, without its language prefix ("/en/taurus" → "/taurus"). */
function pathInMainLanguage(ctx: RenderContext): string {
  const prefix = localePrefix(ctx.locale);
  if (!prefix || !ctx.pagePath.startsWith(prefix)) return ctx.pagePath;
  return ctx.pagePath.slice(prefix.length) || "/";
}

/** PT · ES · EN: each link opens the same page in the other language. */
function LanguageSwitch({ ctx, className = "" }: { ctx: RenderContext; className?: string }) {
  const languages = ctx.site.languages;
  if (languages.length === 0) return null;
  const path = pathInMainLanguage(ctx);
  const all: Locale[] = [MAIN_LOCALE, ...EXTRA_LOCALES.filter((l) => languages.includes(l)).sort((a, b) => languages.indexOf(a) - languages.indexOf(b))];
  const current = ctx.locale ?? MAIN_LOCALE;
  // The blog exists in the main language only: from an article, the other languages open their home page.
  const blog = ctx.site.blog?.slug;
  const inBlog = Boolean(blog) && (path === `/${blog}` || path.startsWith(`/${blog}/`));
  return (
    <ul aria-label={ui(ctx).language} className={`flex items-center gap-0.5 text-[11px] font-semibold tracking-[0.12em] ${className}`}>
      {all.map((l) => {
        const label = localeLabel(l);
        return (
          <li key={l}>
            <a
              href={localHref({ locale: l }, inBlog && l !== MAIN_LOCALE ? "/" : path)}
              hrefLang={label.htmlLang}
              lang={label.htmlLang}
              aria-current={l === current ? "true" : undefined}
              title={label.name}
              className="block rounded px-1.5 py-1 text-muted transition hover:text-ink aria-[current=true]:text-ink aria-[current=true]:underline aria-[current=true]:underline-offset-4"
            >
              {label.short}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** The logo for the background it sits on, falling back to the business name in the heading font. */
function Brand({ ctx, onDark, className = "h-10 w-auto max-w-full object-contain object-left sm:h-11" }: { ctx: RenderContext; onDark: boolean; className?: string }) {
  const { business } = ctx.site;
  const logo = resolveImage(ctx, onDark ? (business.logoOnDark ?? business.logo) : business.logo);
  return (
    <a href={localHref(ctx, "/")} className="flex min-w-0 items-center" aria-label={ui(ctx).homeOf(business.name)}>
      {logo && ctx.site.theme.showNameWithLogo ? (
        <span className="flex min-w-0 items-center gap-2.5">
          <Picture image={{ ...logo, alt: "" }} sizes="96px" priority className="size-10 shrink-0 object-contain sm:size-11" />
          <span className="truncate font-heading text-lg leading-none tracking-tight uppercase sm:text-xl">{business.name}</span>
        </span>
      ) : logo ? (
        <Picture image={{ ...logo, alt: logo.alt || business.name }} sizes="240px" priority className={className} />
      ) : (
        // Text wordmark for sites without a logo (common on personal sites).
        <span className="font-heading text-xl font-extrabold tracking-tight sm:text-2xl">
          {business.name}
          <span className="text-brand">.</span>
        </span>
      )}
    </a>
  );
}

function contactCta(ctx: RenderContext): { href: string; external: boolean } {
  const whatsapp = ctx.site.business.whatsapp;
  return whatsapp
    ? { href: whatsappUrl(whatsapp.number, whatsapp.defaultMessage), external: true }
    : { href: contactHref(ctx), external: false };
}

/** Contacts above the header (theme.topBar): phone, e-mail, WhatsApp and social links. */
function TopBar({ ctx }: { ctx: RenderContext }) {
  const { business } = ctx.site;
  const socials = Object.entries(business.socials).filter((entry): entry is [keyof typeof SOCIAL_LABELS, string] => Boolean(entry[1]));
  return (
    <div className="site-topbar bg-brand text-brand-contrast">
      <Container className="flex min-h-10 flex-wrap items-center justify-between gap-x-6 gap-y-1 py-1.5 text-xs font-semibold">
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-1">
          {business.whatsapp && (
            <li>
              <a href={whatsappUrl(business.whatsapp.number, business.whatsapp.defaultMessage)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:underline">
                <WhatsAppGlyph className="size-4" /> WhatsApp {formatPhone(business.whatsapp.number.replace(/^55/, ""))}
              </a>
            </li>
          )}
          {business.phone && business.phone !== business.whatsapp?.number.replace(/^55/, "") && (
            <li className="hidden sm:block">
              <a href={telHref(business.phone)} className="inline-flex items-center gap-2 hover:underline">
                <Icon name="phone" className="size-4" /> {formatPhone(business.phone)}
              </a>
            </li>
          )}
          {business.email && (
            <li className="hidden md:block">
              <a href={`mailto:${business.email}`} className="inline-flex items-center gap-2 hover:underline">
                <Icon name="mail" className="size-4" /> {business.email}
              </a>
            </li>
          )}
        </ul>
        {socials.length > 0 && (
          <ul className="hidden items-center gap-3 sm:flex">
            {socials.map(([key, href]) => (
              <li key={key}>
                <a href={href} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL_LABELS[key]} className="opacity-90 hover:opacity-100">
                  <SocialIcon name={key} className="size-4" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </div>
  );
}

export function SiteHeader({ ctx }: { ctx: RenderContext }) {
  // A landing page keeps only the logo and the button: nothing to leave the page through.
  const landing = ctx.site.pages.some((p) => p.landing && pageHref(ctx, p.slug) === ctx.pagePath);
  const menu = landing ? [] : ctx.site.pages.filter((p) => p.showInMenu);
  const overlay = ctx.site.theme.header === "overlay";
  const dark = ctx.site.theme.header === "dark" || overlay;
  // Long menus switch to the compact (mobile) menu earlier so items never wrap.
  const long = menu.length > 5;
  const custom = ctx.site.theme.headerCta;
  const cta = custom ? { href: ctaHref(ctx, custom), external: isExternal(ctaHref(ctx, custom)) } : contactCta(ctx);
  const hideCta = ctx.site.theme.hideHeaderCta && !landing;
  const utility = ctx.site.theme.utilityLinks;
  const socials = Object.entries(ctx.site.business.socials).filter((entry): entry is [keyof typeof SOCIAL_LABELS, string] => Boolean(entry[1]));
  const ctaLink = hideCta ? null : (
    <a
      href={cta.href}
      {...(cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="inline-flex min-h-11 items-center gap-2 rounded-[var(--button-radius)] bg-brand px-5 text-xs font-semibold uppercase tracking-[0.14em] whitespace-nowrap text-brand-contrast transition hover:brightness-110"
    >
      {custom?.label ?? ui(ctx).talkToUs}
    </a>
  );

  // Overlay: the top bar and the header lie over the opening hero and scroll away with it (styles.css: .site-chrome-overlay).
  const Wrap = overlay ? "div" : Fragment;
  return (
    <Wrap {...(overlay ? { className: "site-chrome-overlay tone-dark" } : {})}>
    {ctx.site.theme.topBar && <TopBar ctx={ctx} />}
    <header
      className={`site-header z-40 border-b ${overlay ? "border-white/15" : `sticky top-0 backdrop-blur-xl backdrop-saturate-150 ${dark ? "tone-dark border-white/10 bg-[color-mix(in_srgb,var(--dark)_94%,transparent)]" : "tone-light border-[var(--line)] bg-white/85"}`}`}
    >
      {utility.length > 0 && (
        <Container className="header-utility hidden items-center justify-between pt-3 lg:flex">
          <ul className="flex items-center gap-4">
            {socials.map(([key, href]) => (
              <li key={key}>
                <a href={href} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL_LABELS[key]} className="block opacity-90 transition hover:opacity-100">
                  <SocialIcon name={key} />
                </a>
              </li>
            ))}
          </ul>
          <ul className="flex items-center gap-8 text-[0.65rem]">
            {utility.map((l) => (
              <li key={l.href}>
                <a href={localHref(ctx, l.href)} aria-current={ctx.pagePath.replace(/\/$/, "") === localHref(ctx, l.href).replace(/\/$/, "") ? "page" : undefined} className="header-utility-link transition">{l.label}</a>
              </li>
            ))}
          </ul>
        </Container>
      )}
      <Container className="flex h-20 items-center justify-between gap-4 sm:gap-8">
        <Brand ctx={ctx} onDark={dark} />
        <nav aria-label={ui(ctx).mainNav} className={`hidden items-center ${long ? "gap-6 xl:flex" : "gap-9 lg:flex"}`}>
          {menu.map((p) => {
            const link = (
              <a
                href={pageHref(ctx, p.slug)}
                aria-current={isCurrent(ctx, p.slug) ? "page" : undefined}
                className="inline-flex items-center gap-1.5 py-3 text-xs font-semibold uppercase tracking-[0.14em] whitespace-nowrap text-muted transition hover:text-ink aria-[current=page]:text-ink"
              >
                {p.title}
                {(p.menuChildren.length > 0 || p.megaMenu) && <span aria-hidden className="text-[0.6rem] opacity-60 transition group-hover:rotate-180">▾</span>}
              </a>
            );
            if (p.megaMenu) {
              const art = resolveImage(ctx, p.megaMenu.image);
              return (
                <div key={p.slug} className="group">
                  {link}
                  {/* The full panel without JavaScript: opens on hover and on keyboard focus. */}
                  <div className="mega-menu tone-light invisible absolute inset-x-0 top-full z-50 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    <div className="mx-auto flex max-w-5xl items-center gap-10 bg-white p-8 shadow-2xl">
                      {art && <Picture image={art} sizes="200px" className="hidden h-auto w-44 shrink-0 object-contain xl:block" />}
                      <div className="columns-3 gap-8">
                        {p.megaMenu.groups.map((g) => (
                          <div key={g.title} className="mb-5 break-inside-avoid">
                            {g.href ? <a href={localHref(ctx, g.href)} className="mega-menu-title block">{g.title}</a> : <p className="mega-menu-title">{g.title}</p>}
                            <ul className="mt-3 space-y-2.5">
                              {g.links.map((l) => (
                                <li key={l.href}><a href={localHref(ctx, l.href)} className="mega-menu-link block">{l.label}</a></li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            if (p.menuChildren.length === 0) return <div key={p.slug}>{link}</div>;
            // Dropdown without JavaScript: opens on hover and on keyboard focus.
            return (
              <div key={p.slug} className="group relative">
                {link}
                <div className="invisible absolute top-full left-1/2 z-50 -translate-x-1/2 pt-2 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  <ul className="tone-light min-w-56 rounded-[var(--brand-radius)] border border-[var(--line)] bg-surface p-2 shadow-2xl">
                    {p.menuChildren.map((c) => (
                      <li key={c.href}>
                        <a href={localHref(ctx, c.href)} className="block rounded-[calc(var(--brand-radius)/2)] px-4 py-2.5 text-sm font-medium text-muted hover:bg-surface-alt hover:text-ink">
                          {c.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
          <LanguageSwitch ctx={ctx} className="-mr-2" />
          {ctaLink}
        </nav>
        {landing && (
          // Phones: the button may take two short lines rather than run off the screen.
          <a
            href={cta.href}
            {...(cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="inline-flex min-h-11 max-w-[11rem] items-center rounded-[var(--button-radius)] bg-brand px-4 py-1.5 text-center text-[0.68rem] leading-tight font-semibold uppercase tracking-[0.1em] text-brand-contrast lg:hidden"
          >
            {custom?.label ?? ui(ctx).talkToUs}
          </a>
        )}
        {/* Mobile menu without JavaScript. */}
        {!landing && <details className={`group relative ${long ? "xl:hidden" : "lg:hidden"}`}>
          <summary className="flex size-11 cursor-pointer list-none items-center justify-center rounded-[var(--brand-radius)] border border-[var(--line)]" aria-label={ui(ctx).openMenu}>
            <span aria-hidden className="flex w-5 flex-col gap-1.5">
              <span className="h-px bg-current" />
              <span className="h-px bg-current" />
              <span className="h-px bg-current" />
            </span>
          </summary>
          <nav aria-label={ui(ctx).mainNav} className="absolute right-0 mt-3 flex max-h-[80vh] w-72 flex-col gap-1 overflow-y-auto rounded-[var(--brand-radius)] border border-[var(--line)] bg-surface p-3 shadow-2xl">
            {menu.map((p) => (
              <div key={p.slug}>
                <a href={pageHref(ctx, p.slug)} className="block rounded px-3 py-3 text-sm font-semibold uppercase tracking-[0.12em] hover:bg-surface-alt">
                  {p.title}
                </a>
                {p.megaMenu?.groups.map((g) => (
                  <div key={g.title} className="mb-2 ml-3 border-l border-[var(--line)] pl-2">
                    <p className="px-3 pt-2 text-xs font-semibold">{g.title}</p>
                    <ul>
                      {g.links.map((l) => (
                        <li key={l.href}><a href={localHref(ctx, l.href)} className="block rounded px-3 py-2 text-sm text-muted hover:bg-surface-alt hover:text-ink">{l.label}</a></li>
                      ))}
                    </ul>
                  </div>
                ))}
                {p.menuChildren.length > 0 && (
                  <ul className="mb-1 ml-3 border-l border-[var(--line)] pl-2">
                    {p.menuChildren.map((c) => (
                      <li key={c.href}>
                        <a href={localHref(ctx, c.href)} className="block rounded px-3 py-2 text-sm text-muted hover:bg-surface-alt hover:text-ink">
                          {c.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            <LanguageSwitch ctx={ctx} className="mt-2 px-1.5" />
            {ctaLink && <div className="mt-2 px-1">{ctaLink}</div>}
            {utility.map((l) => (
              <a key={l.href} href={localHref(ctx, l.href)} className="block rounded px-3 py-2 text-xs text-muted hover:bg-surface-alt hover:text-ink">{l.label}</a>
            ))}
          </nav>
        </details>}
      </Container>
    </header>
    </Wrap>
  );
}

const SOCIAL_LABELS = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", youtube: "YouTube", tiktok: "TikTok" } as const;

export function SiteFooter({ ctx }: { ctx: RenderContext }) {
  const { business, pages } = ctx.site;
  const socials = Object.entries(business.socials).filter((entry): entry is [keyof typeof SOCIAL_LABELS, string] => Boolean(entry[1]));
  const address = business.address;
  return (
    <footer className="tone-dark pt-20 pb-10 text-sm" data-footer={ctx.site.theme.footerTone}>
      <Container className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.2fr]">
        <div>
          <Brand ctx={ctx} onDark className="h-12 w-auto" />
          {business.tagline && <p className="mt-6 max-w-sm leading-relaxed text-muted">{business.tagline}</p>}
          {socials.length > 0 && (
            <ul className="mt-8 flex gap-3">
              {socials.map(([key, href]) => (
                <li key={key}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={SOCIAL_LABELS[key]}
                    className="flex size-10 items-center justify-center rounded-full border border-[var(--line)] text-muted transition hover:border-brand-text hover:text-brand-text"
                  >
                    <SocialIcon name={key} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {ctx.site.theme.footerColumns.length > 0 ? (
          <nav aria-label={ui(ctx).footerNav} className="footer-columns grid gap-10 sm:grid-cols-3 lg:col-span-2">
            {ctx.site.theme.footerColumns.map((col) => (
              <div key={col.title}>
                <p className="mb-5 font-heading text-base font-semibold text-ink">{col.title}</p>
                <ul className="space-y-3">
                  {col.links.map((l) => (
                    <li key={l.label}><a href={localHref(ctx, l.href)} className="text-muted transition hover:text-ink">{l.label}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        ) : (
        <nav aria-label={ui(ctx).footerNav}>
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-brand-text">{ui(ctx).navigation}</p>
          <ul className="space-y-3">
            {pages.filter((p) => p.showInMenu || p.showInFooter).map((p) => (
              <li key={p.slug}>
                <a href={pageHref(ctx, p.slug)} className="text-muted transition hover:text-ink">
                  {p.title}
                </a>
              </li>
            ))}
            <li>
              <a href={localHref(ctx, "/privacidade")} className="text-muted transition hover:text-ink">
                {ui(ctx).privacyPolicy}
              </a>
            </li>
            <li>
              <a href={localHref(ctx, "/termos-de-uso")} className="text-muted transition hover:text-ink">
                {ui(ctx).termsOfUse}
              </a>
            </li>
            <li>
              {/* Handled by the CookieConsent client component of the sites app. */}
              <button type="button" data-cookie-preferences className="text-muted transition hover:text-ink">
                {ui(ctx).cookiePrefs}
              </button>
            </li>
          </ul>
        </nav>
        )}

        {/* No heading over an empty column while the client has no phone, e-mail or address yet. */}
        {ctx.site.theme.footerColumns.length === 0 && (business.phone || business.whatsapp || business.email || address || business.openingHours) && (
          <div>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-brand-text">{ui(ctx).contact}</p>
            <ul className="space-y-4 text-muted">
              {business.phone && (
                <li className="flex gap-3">
                  <Icon name="phone" className="mt-0.5 size-4 shrink-0" />
                  <a href={telHref(business.phone)} className="hover:text-ink">{formatPhone(business.phone)}</a>
                </li>
              )}
              {business.whatsapp && (
                <li className="flex gap-3">
                  <WhatsAppGlyph className="mt-0.5 size-4 shrink-0" />
                  <a href={whatsappUrl(business.whatsapp.number, business.whatsapp.defaultMessage)} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
                    WhatsApp
                  </a>
                </li>
              )}
              {business.email && (
                <li className="flex gap-3">
                  <Icon name="mail" className="mt-0.5 size-4 shrink-0" />
                  <a href={`mailto:${business.email}`} className="hover:text-ink">{business.email}</a>
                </li>
              )}
              {address && (
                <li className="flex gap-3">
                  <Icon name="mapPin" className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {address.street && <>{address.street}<br /></>}
                    {address.city} – {address.state}
                    {address.postalCode && `, ${address.postalCode}`}
                  </span>
                </li>
              )}
              {business.openingHours && (
                <li className="flex gap-3">
                  <Icon name="clock" className="mt-0.5 size-4 shrink-0" />
                  <span>{business.openingHours}</span>
                </li>
              )}
            </ul>
          </div>
        )}
      </Container>
      {business.footerNotice && (
        <Container className="mt-12">
          <p className="max-w-4xl text-xs leading-relaxed text-muted">{business.footerNotice}</p>
        </Container>
      )}
      <Container className={`${business.footerNotice ? "mt-6" : "mt-16"} flex flex-col gap-3 border-t border-[var(--line)] pt-8 text-xs text-muted sm:flex-row sm:justify-between`}>
        <span>
          © {new Date().getFullYear()} {business.name}. {ui(ctx).rights}
          {ctx.site.theme.footerColumns.length > 0 && (
            <>
              {" · "}
              <a href={localHref(ctx, "/privacidade")} className="hover:text-ink">{ui(ctx).privacyPolicy}</a>
              {" · "}
              <a href={localHref(ctx, "/termos-de-uso")} className="hover:text-ink">{ui(ctx).termsOfUse}</a>
              {" · "}
              <button type="button" data-cookie-preferences className="hover:text-ink">{ui(ctx).cookiePrefs}</button>
            </>
          )}
        </span>
        <a href={SPINOS_URL} target="_blank" rel="noopener" className="group inline-flex items-center gap-1.5 hover:text-ink">
          {ui(ctx).madeBy} <span className="font-semibold text-ink/80 transition group-hover:text-brand-text">Spinos</span>
          <Icon name="arrowRight" className="size-3 -rotate-45 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>
      </Container>
    </footer>
  );
}

/**
 * The short form that comes before WhatsApp (business.whatsapp.leadCapture): name, WhatsApp and e-mail become a
 * lead (panel, e-mail, the client's CRM) even if the chat never starts. The site script opens it on any WhatsApp
 * link and then opens the chat with the name in the message; without JavaScript the links go straight to WhatsApp.
 */
export function WhatsAppCapture({ ctx }: { ctx: RenderContext }) {
  const whatsapp = ctx.site.business.whatsapp;
  if (!whatsapp?.leadCapture) return null;
  const t = ui(ctx);
  const field = "mt-1.5 block min-h-12 w-full rounded-[calc(var(--brand-radius)/2)] border border-[#d5d8e0] bg-white px-4 text-base text-[#16181d] outline-none focus:border-[#128c4a] focus:ring-2 focus:ring-[#128c4a]/25";
  return (
    <dialog
      data-wa-capture
      aria-labelledby="wa-capture-title"
      className="wa-capture m-auto w-[min(92vw,27rem)] rounded-[var(--brand-radius)] bg-white p-0 text-[#16181d] shadow-2xl backdrop:bg-black/55 backdrop:backdrop-blur-sm"
    >
      <form method="post" action="/api/lead" data-wa-intro={t.waIntro} className="grid gap-4 p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#128c4a] text-white">
              <WhatsAppGlyph className="size-6" />
            </span>
            <p id="wa-capture-title" className="font-heading text-lg leading-snug font-semibold">
              {t.waCaptureTitle}
            </p>
          </div>
          <button type="button" data-wa-close aria-label={t.close} className="-mt-1 -mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-[#5b6270] hover:bg-[#f1f2f5]">
            ×
          </button>
        </div>
        <p className="text-sm leading-relaxed text-[#5b6270]">{t.waCaptureText}</p>
        <input type="hidden" name="page" value={ctx.pagePath} />
        <input type="hidden" name="section" value="whatsapp" />
        <input type="hidden" name="intent" value="whatsapp" />
        <input type="hidden" name="ts" />
        <input type="hidden" name="attr" />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <label className="text-sm font-semibold">
          {t.nameRequired}
          <input name="name" required maxLength={120} autoComplete="name" className={field} />
        </label>
        <label className="text-sm font-semibold">
          {t.waCapturePhone} *
          <input name="phone" type="tel" required minLength={10} maxLength={30} inputMode="tel" autoComplete="tel" placeholder="(11) 98765-4321" className={field} />
        </label>
        <label className="text-sm font-semibold">
          {t.email} *
          <input name="email" type="email" required maxLength={200} autoComplete="email" className={field} />
        </label>
        {whatsapp.askMessage ? (
          <label className="text-sm font-semibold">
            {t.waCaptureMessage} *
            <textarea name="message" required minLength={3} maxLength={500} rows={3} placeholder={t.waCaptureMessageHint} className={`${field} py-3`} />
          </label>
        ) : null}
        <p className="text-xs leading-relaxed text-[#5b6270]">
          {t.consentBefore}{" "}
          <a className="underline" href={localHref(ctx, "/privacidade")}>
            {t.privacyPolicy}
          </a>
          {t.policyEnd}
        </p>
        <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-[var(--button-radius)] bg-[#128c4a] px-6 text-sm font-semibold text-white transition hover:brightness-110">
          <WhatsAppGlyph className="size-5" /> {t.waCaptureSubmit}
        </button>
      </form>
    </dialog>
  );
}

export function WhatsAppFloat({ ctx }: { ctx: RenderContext }) {
  const whatsapp = ctx.site.business.whatsapp;
  if (!whatsapp?.floatingButton) return null;
  return (
    <a
      href={whatsappUrl(whatsapp.number, whatsapp.defaultMessage)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ui(ctx).whatsappTalk}
      className="whatsapp-float group fixed right-5 bottom-5 z-50 flex h-14 items-center gap-3 rounded-full bg-[#128c4a] px-3.5 text-white shadow-[0_12px_30px_-8px_rgb(0_0_0/0.35)] transition hover:-translate-y-0.5 sm:right-6 sm:bottom-6"
    >
      <WhatsAppGlyph className="size-7" />
      <span className="hidden pr-1.5 text-sm font-semibold sm:inline">{ui(ctx).whatsappFloat}</span>
    </a>
  );
}

/** Phones only: up to two buttons fixed at the foot of the screen (the page's main offers). */
export function MobileBar({ ctx }: { ctx: RenderContext }) {
  const items = ctx.site.theme.mobileBar;
  if (items.length === 0) return null;
  return (
    <>
      {/* The page ends above the bar instead of under it. */}
      <div aria-hidden className="mobile-bar-spacer h-20 md:hidden" />
      <nav aria-label={ui(ctx).mainNav} className={`mobile-bar fixed inset-x-0 bottom-0 z-40 grid gap-2.5 border-t border-[var(--line)] bg-surface px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.25)] md:hidden ${items.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
        {items.map((item, i) => (
          <a
            key={item.href}
            href={item.href.startsWith("/") ? localHref(ctx, item.href) : item.href}
            className={`mobile-bar-btn inline-flex h-12 items-center justify-center rounded-[var(--button-radius)] px-3 text-sm font-semibold ${i === 0 ? "bg-brand text-brand-contrast" : "mobile-bar-alt border border-[var(--line)] bg-surface"}`}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </>
  );
}
