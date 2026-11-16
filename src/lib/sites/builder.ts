import { z } from "zod";
import type { NichePack } from "@/packs/schema";
import { SITE_VARIABLES } from "@/packs/schema";
import { parseSiteContent, type SiteContent } from "@/lib/sites/content";

/*
 * Gera o rascunho de um site (páginas do site + páginas de captação) a partir do briefing do
 * cliente e do modelo do pacote de nicho. Função pura: sem banco, sem rede. Todo texto de nicho
 * vem do pack.json; aqui só existe a montagem (qual seção vai em qual página, como preencher
 * as variáveis, como validar o resultado).
 */

/** O que fica salvo no rascunho e na versão publicada de um site. */
export type SiteDocument = {
  content: SiteContent;
  /** Imagens enviadas (assetId → arquivo). Vazio enquanto os modelos não usam imagens. */
  media: Record<string, never>;
  posts: never[];
};

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const briefingSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(100),
  city: z.string().trim().min(2, "Informe a cidade").max(80),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Use a sigla do estado, ex.: SP"),
  whatsapp: z.string().trim().min(8, "Informe o WhatsApp").max(30),
  phone: optionalString(30),
  email: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.email("E-mail inválido").max(200).optional()),
  street: optionalString(200),
  /** Quem responde tecnicamente pelo negócio (aviso do rodapé em nichos regulados). */
  responsibleName: optionalString(120),
  /** Registro profissional como se escreve, ex.: "CRC 1SP123456/O-0". */
  registration: optionalString(60),
  instagram: optionalString(300),
  primaryColor: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor no formato #RRGGBB").optional()),
  /** Serviços próprios, no lugar dos do modelo (título e descrição opcional). */
  services: z.array(z.object({ title: z.string().trim().min(1).max(80), description: optionalString(400) })).max(12).optional(),
});
export type Briefing = z.infer<typeof briefingSchema>;

export class BriefingError extends Error {
  constructor(public issues: { path: string; message: string }[]) {
    super(issues.map((i) => i.message).join("; "));
    this.name = "BriefingError";
  }
}

/** Valida o briefing contra as exigências do pacote (ex.: registro profissional). */
export function parseBriefing(input: unknown, pack: NichePack): Briefing {
  const parsed = briefingSchema.safeParse(input);
  const issues = parsed.success ? [] : parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
  const data = parsed.success ? parsed.data : null;
  if (data && pack.site?.requireRegistration) {
    if (!data.responsibleName) issues.push({ path: "responsibleName", message: "Informe o nome do responsável técnico" });
    if (!data.registration) issues.push({ path: "registration", message: "Informe o número do registro profissional" });
  }
  if (issues.length > 0 || !data) throw new BriefingError(issues);
  return data;
}

type Vars = Record<(typeof SITE_VARIABLES)[number], string>;

const fill = (text: string, vars: Vars) => text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (whole, name: string) => (name in vars ? vars[name as keyof Vars] : whole));
/** Corta no limite do esquema sem deixar a palavra pela metade. */
const fit = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

const slugPart = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Texto do endereço provisório: "Padaria do Sol" → "padaria-do-sol". */
export function subdomainLabel(name: string): string {
  const label = slugPart(name).slice(0, 40).replace(/-+$/g, "");
  return label.length >= 3 ? label : `site-${label || "novo"}`;
}

function varsFrom(briefing: Briefing): Vars {
  return { negocio: briefing.name, cidade: briefing.city, responsavel: briefing.responsibleName ?? "", registro: briefing.registration ?? "" };
}

type Section = SiteContent["pages"][number]["sections"][number];
type Cta = { label: string; action: { type: "link"; href: string } | { type: "whatsapp" } };

/**
 * Monta o conteúdo do site. Lança BriefingError se o briefing não atende o pacote e Error se o
 * modelo gerar conteúdo inválido (o que um teste de pacote impede de chegar à produção).
 */
export function buildSiteContent(pack: NichePack, briefingInput: unknown): SiteContent {
  const template = pack.site;
  if (!template) throw new Error(`O pacote ${pack.key} não tem modelo de site`);
  const briefing = parseBriefing(briefingInput, pack);
  const vars = varsFrom(briefing);
  const t = (text: string) => fill(text, vars);

  const hasWhatsApp = true; // o briefing exige WhatsApp
  const whatsappCta = (label: string): Cta => ({ label: fit(t(label), 40), action: { type: "whatsapp" } });
  const linkCta = (label: string, href: string): Cta => ({ label: fit(t(label), 40), action: { type: "link", href } });

  const pages = template.pages.map((page) => {
    const sections: Section[] = [];
    const primary: Cta = page.landing ? linkCta(page.hero.ctaLabel, "#contato") : hasWhatsApp ? whatsappCta(page.hero.ctaLabel) : linkCta(page.hero.ctaLabel, "/contato");
    const heading = fit(t(page.hero.heading), 120);
    sections.push({
      id: "inicio",
      type: "hero",
      variant: "centered",
      hidden: false,
      tone: "auto",
      heading,
      highlight: page.hero.highlight && heading.includes(t(page.hero.highlight)) ? t(page.hero.highlight) : undefined,
      eyebrow: page.hero.eyebrow ? fit(t(page.hero.eyebrow), 60) : undefined,
      subheading: page.hero.subheading ? fit(t(page.hero.subheading), 480) : undefined,
      badges: page.hero.badges.map((b) => fit(t(b), 60)),
      images: [],
      headingHidden: false,
      overlay: "brand",
      pillars: [],
      frame: "browser",
      primaryCta: primary,
    } as Section);

    if (page.about) {
      sections.push({
        id: "sobre",
        type: "about",
        variant: "text-only",
        hidden: false,
        tone: "auto",
        heading: fit(t(page.about.heading), 120),
        body: fit(t(page.about.body), 2000),
        imageFit: "cover",
        highlights: page.about.highlights.map((h) => fit(t(h), 80)),
      } as Section);
    }
    if (page.services) {
      const items = (briefing.services && !page.landing ? briefing.services.map((s) => ({ title: s.title, description: s.description, icon: undefined })) : page.services.items).map((i) => ({
        title: fit(t(i.title), 80),
        description: i.description ? fit(t(i.description), 400) : undefined,
        icon: i.icon,
        featured: false,
      }));
      sections.push({ id: "servicos", type: "services", variant: "cards", hidden: false, tone: "auto", heading: fit(t(page.services.heading), 120), intro: page.services.intro ? fit(t(page.services.intro), 400) : undefined, items } as Section);
    }
    if (page.benefits) {
      sections.push({
        id: "beneficios",
        type: "benefits",
        variant: "cards",
        hidden: false,
        tone: "auto",
        heading: fit(t(page.benefits.heading), 120),
        intro: page.benefits.intro ? fit(t(page.benefits.intro), 400) : undefined,
        items: page.benefits.items.map((i) => ({ title: fit(t(i.title), 80), description: i.description ? fit(t(i.description), 400) : undefined, icon: i.icon, featured: false })),
      } as Section);
    }
    if (page.steps) {
      sections.push({
        id: "etapas",
        type: "steps",
        variant: "timeline",
        hidden: false,
        tone: page.benefits ? "muted" : "auto",
        heading: fit(t(page.steps.heading), 120),
        intro: page.steps.intro ? fit(t(page.steps.intro), 400) : undefined,
        items: page.steps.items.map((i) => ({ title: fit(t(i.title), 80), description: i.description ? fit(t(i.description), 400) : undefined })),
      } as Section);
    }
    if (page.faq) {
      sections.push({
        id: "perguntas",
        type: "faq",
        variant: "accordion",
        hidden: false,
        tone: "auto",
        heading: fit(t(page.faq.heading), 120),
        items: page.faq.items.map((i) => ({ question: fit(t(i.question), 200), answer: fit(t(i.answer), 1500) })),
      } as Section);
    }
    if (page.closing) {
      sections.push({
        id: "chamada",
        type: "cta",
        variant: "banner",
        hidden: false,
        tone: "brand",
        heading: fit(t(page.closing.heading), 120),
        body: page.closing.body ? fit(t(page.closing.body), 300) : undefined,
        cta: hasWhatsApp ? whatsappCta(page.closing.ctaLabel) : linkCta(page.closing.ctaLabel, "/contato"),
      } as Section);
    }
    if (page.contact) {
      sections.push({
        id: "contato",
        type: "contact",
        variant: page.landing ? "form-only" : "form-and-info",
        hidden: false,
        tone: page.landing ? "muted" : "auto",
        heading: fit(t(page.contact.heading), 120),
        intro: page.contact.intro ? fit(t(page.contact.intro), 1500) : undefined,
        submitLabel: page.contact.submitLabel ? fit(t(page.contact.submitLabel), 40) : undefined,
        messageLabel: page.contact.messageLabel ? fit(t(page.contact.messageLabel), 60) : undefined,
        messagePlaceholder: page.contact.messagePlaceholder ? fit(t(page.contact.messagePlaceholder), 200) : undefined,
        extraFields: [],
        requireEmailAndCompany: false,
        hideContacts: false,
        fields: { company: false, phone: true, email: true, message: true },
        hideAddress: false,
        successMessage: "Recebemos sua mensagem. Em breve entraremos em contato.",
        anonymous: false,
      } as Section);
    }

    return {
      slug: page.slug,
      title: fit(t(page.title), 80),
      showInMenu: page.landing ? false : page.showInMenu,
      showInFooter: false,
      landing: page.landing,
      menuChildren: [],
      seo: { title: fit(t(page.seoTitle), 70), description: fit(t(page.seoDescription), 170), noindex: false, kind: page.kind },
      sections,
    };
  });

  const footerNotice = template.footerNotice && (!template.requireRegistration || (briefing.responsibleName && briefing.registration)) ? fit(t(template.footerNotice), 400) : undefined;
  const instagram = briefing.instagram ? (briefing.instagram.startsWith("http") ? briefing.instagram : `https://instagram.com/${briefing.instagram.replace(/^@/, "")}`) : undefined;

  const content = {
    schemaVersion: 1,
    theme: {
      colors: { primary: briefing.primaryColor ?? template.colors.primary, secondary: template.colors.secondary, accent: template.colors.accent },
      fontPair: "inter",
      radius: "md",
      buttonStyle: "solid",
      density: "comfortable",
      mode: "light",
      headlineStyle: "accent",
      style: "classico",
      header: "light",
    },
    business: {
      name: briefing.name,
      tagline: template.tagline ? fit(t(template.tagline), 160) : undefined,
      phone: briefing.phone,
      email: briefing.email,
      whatsapp: { number: briefing.whatsapp, defaultMessage: `Olá! Vim pelo site da ${briefing.name}.`, floatingButton: true, leadCapture: true, askMessage: false },
      address: { street: briefing.street, city: briefing.city, state: briefing.state },
      socials: instagram ? { instagram } : {},
      footerNotice,
      areasServed: [briefing.city],
    },
    integrations: {},
    seo: { title: fit(briefing.name, 70), description: template.tagline ? fit(t(template.tagline), 170) : undefined },
    pages,
  };
  return parseSiteContent(content);
}

export function buildSiteDocument(pack: NichePack, briefing: unknown): SiteDocument {
  return { content: buildSiteContent(pack, briefing), media: {}, posts: [] };
}

/**
 * Atualiza os dados do negócio de um rascunho já existente (nome, contatos, endereço, cor,
 * aviso do rodapé) sem refazer as páginas, para não perder o que a pessoa já ajustou nelas.
 */
export function applyBriefingToDocument(pack: NichePack, current: SiteDocument, briefingInput: unknown): SiteDocument {
  const fresh = buildSiteContent(pack, briefingInput);
  const content: SiteContent = {
    ...current.content,
    theme: { ...current.content.theme, colors: { ...current.content.theme.colors, primary: fresh.theme.colors.primary } },
    business: { ...current.content.business, ...fresh.business, logo: current.content.business.logo, logoOnDark: current.content.business.logoOnDark, favicon: current.content.business.favicon },
    seo: { ...current.content.seo, title: fresh.seo.title },
  };
  return { ...current, content: parseSiteContent(content) };
}
