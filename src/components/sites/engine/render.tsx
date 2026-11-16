import type { CSSProperties, ReactNode } from "react";
import type { Section } from "@/lib/sites/content";
import { accentVariables } from "./theme";
import type { RenderContext } from "./context";
import { AboutSection, BenefitsSection, NumbersSection, ServicesSection } from "./sections/content";
import { ContactSection, CtaSection, type LeadStatus, MapSection, NewsletterSection, OffersSection } from "./sections/conversion";
import { ComparisonSection } from "./sections/comparison";
import { DownloadsSection, SnippetsSection } from "./sections/downloads";
import { PromoSection } from "./sections/promo";
import { InstagramSection } from "./sections/instagram";
import { ToolSection } from "./sections/tool";
import { localHref, localePrefix } from "./i18n";
import { ModelsSection, RangesSection, SpecsSection } from "./sections/industrial";
import { HeroSection } from "./sections/hero";
import { MarqueeSection, StatementSection } from "./sections/motion";
import { DocumentSection, PostsSection } from "./blog";
import { CredentialsSection, StepsSection, TeamSection } from "./sections/people";
import { ClientsSection, FaqSection, TestimonialsSection } from "./sections/social";

/**
 * Section types a compliance mode never renders. OAB Provimento 205/2021
 * restricts testimonials and result figures in law-firm advertising.
 */
const BLOCKED_BY_COMPLIANCE: Record<string, ReadonlySet<Section["type"]>> = {
  none: new Set(),
  oab: new Set(["testimonials", "numbers"]),
};

export function isRenderable(section: Section, ctx: RenderContext): boolean {
  return !section.hidden && !BLOCKED_BY_COMPLIANCE[ctx.site.business.complianceMode]?.has(section.type);
}

/** Result of a form post, shown only by the section whose form was sent. */
export type LeadResult = { status: LeadStatus; section?: string };

export function SectionView({ section, ctx, lead }: { section: Section; ctx: RenderContext; lead?: LeadResult }) {
  const leadStatus = lead && (!lead.section || lead.section === section.id) ? lead.status : undefined;
  switch (section.type) {
    case "hero":
      return <HeroSection section={section} ctx={ctx} />;
    case "about":
      return <AboutSection section={section} ctx={ctx} />;
    case "services":
      return <ServicesSection section={section} ctx={ctx} />;
    case "benefits":
      return <BenefitsSection section={section} ctx={ctx} />;
    case "numbers":
      return <NumbersSection section={section} ctx={ctx} />;
    case "testimonials":
      return <TestimonialsSection section={section} ctx={ctx} />;
    case "clients":
      return <ClientsSection section={section} ctx={ctx} />;
    case "faq":
      return <FaqSection section={section} ctx={ctx} />;
    case "cta":
      return <CtaSection section={section} ctx={ctx} />;
    case "contact":
      return <ContactSection section={section} ctx={ctx} status={leadStatus} />;
    case "map":
      return <MapSection section={section} ctx={ctx} />;
    case "credentials":
      return <CredentialsSection section={section} ctx={ctx} />;
    case "steps":
      return <StepsSection section={section} ctx={ctx} />;
    case "team":
      return <TeamSection section={section} ctx={ctx} />;
    case "posts":
      return <PostsSection section={section} ctx={ctx} />;
    case "marquee":
      return <MarqueeSection section={section} ctx={ctx} />;
    case "statement":
      return <StatementSection section={section} ctx={ctx} />;
    case "newsletter":
      return <NewsletterSection section={section} ctx={ctx} status={leadStatus} />;
    case "offers":
      return <OffersSection section={section} ctx={ctx} />;
    case "comparison":
      return <ComparisonSection section={section} ctx={ctx} />;
    case "tool":
      return <ToolSection section={section} ctx={ctx} />;
    case "models":
      return <ModelsSection section={section} ctx={ctx} />;
    case "ranges":
      return <RangesSection section={section} ctx={ctx} />;
    case "specs":
      return <SpecsSection section={section} ctx={ctx} />;
    case "document":
      return <DocumentSection section={section} ctx={ctx} />;
    case "downloads":
      return <DownloadsSection section={section} ctx={ctx} />;
    case "snippets":
      return <SnippetsSection section={section} ctx={ctx} />;
    case "promo":
      return <PromoSection section={section} ctx={ctx} />;
    case "instagram":
      return <InstagramSection section={section} ctx={ctx} />;
  }
}

/**
 * Every page gets exactly one <h1>: the hero's heading, or — on pages without
 * a visible hero — the title of the first section.
 */
/** Every internal link of a section ("href" at any depth) pointed at the page's language. */
function withLocalLinks<T>(value: T, ctx: RenderContext): T {
  if (Array.isArray(value)) return value.map((v) => withLocalLinks(v, ctx)) as T;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, k === "href" && typeof v === "string" ? localHref(ctx, v) : withLocalLinks(v, ctx)]),
  ) as T;
}

/** A section with its own accent color: a box-less wrapper carrying the overridden brand variables. */
function AccentScope({ color, ctx, children }: { color?: string; ctx: RenderContext; children: ReactNode }) {
  if (!color) return <>{children}</>;
  return (
    <div className="contents" style={accentVariables(color, ctx.site.theme.dark ?? "#15171c") as CSSProperties}>
      {children}
    </div>
  );
}

export function SectionList({ sections, ctx, lead }: { sections: Section[]; ctx: RenderContext; lead?: LeadResult }) {
  const localized = localePrefix(ctx.locale) ? sections.map((s) => withLocalLinks(s, ctx)) : sections;
  const visible = localized.filter((s) => isRenderable(s, ctx));
  const hasHero = visible.some((s) => s.type === "hero");
  return (
    <>
      {visible.map((s, i) => (
        <AccentScope key={s.id} color={s.accent} ctx={ctx}>
          <SectionView section={s} ctx={!hasHero && i === 0 ? { ...ctx, primaryHeading: true } : ctx} lead={lead} />
        </AccentScope>
      ))}
    </>
  );
}
