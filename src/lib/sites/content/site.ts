import { z } from "zod";
import { cta, hexColor, href, imageRef, optionalText, phoneDigits, shortText } from "./primitives";
import { blogConfig } from "./blog";
import { section } from "./sections";

/**
 * Bump when the shape of SiteContent changes in a way old documents don't
 * satisfy, and add a step to `MIGRATIONS` that upgrades the previous version.
 */
export const CURRENT_SCHEMA_VERSION = 1;

/** Curated, self-hosted font pairs (heading / body). Arbitrary fonts would hurt performance. */
export const FONT_PAIRS = [
  "inter",
  "manrope",
  "playfair-inter",
  "lora-source-sans",
  "montserrat-open-sans",
  "dm-serif-dm-sans",
  "cormorant-montserrat",
  "montserrat",
  /** Condensed display headings (performance/agency look) with Inter text. */
  "barlow-inter",
  /** Wide geometric display headings (Archivo, expanded) with Inter text. */
  "archivo-inter",
  /** Wide Archivo headings, IBM Plex Sans text and IBM Plex Mono labels (industrial, technical). */
  "archivo-plex",
  /** Saira headings (industrial, light-to-black weights for strong contrast), IBM Plex text and mono labels. */
  "saira-plex",
  /** Poppins for headings and text (geometric, rounded; events and corporate brands). */
  "poppins",
  /** Newsreader headings (editorial serif with true italics, for law and advisory firms) with Inter text. */
  "newsreader-inter",
  /** Bodoni Moda headings over Poppins: a high-contrast fashion serif, for elegant personal brands (clinics, studios). */
  "bodoni-poppins",
  /** Poppins headings over Open Sans text. */
  "poppins-open-sans",
  /**
   * Segoe UI, the brand font of firms that work on Windows. It cannot be served as a web font (Microsoft's
   * licence), so it comes from the visitor's own system; elsewhere Open Sans, its closest open cut, takes over.
   */
  "segoe-open-sans",
  "anton-nunito",
  /** Jost for headings and text: geometric in the manner of Futura (clinics, studios, fashion). */
  "jost",
  /** Anton captions over Baloo 2, a round, friendly text face (cartoon and kids brands). */
  "anton-baloo",
] as const;

export const theme = z.object({
  /**
   * The brand's own typeface (licensed for the web), self-hosted as .woff2 files. Takes the place of the
   * font pair's heading and/or body family; the pair stays as the fallback while the files load.
   */
  customFont: z
    .object({
      name: z.string().regex(/^[A-Za-z0-9 -]{2,60}$/, "Use letras, números, espaço e hífen"),
      files: z
        .array(
          z.object({
            weight: z.number().int().min(100).max(900),
            src: z.string().regex(/^(\/[A-Za-z0-9._\/-]+|https:\/\/[A-Za-z0-9._\/-]+)\.woff2$/, "Arquivo .woff2"),
          }),
        )
        .min(1)
        .max(9),
      use: z.enum(["both", "heading", "body"]).default("both"),
    })
    .optional(),
  /** Small tile repeated on light bands by styles that use a texture (e.g. the brand monogram), in place of their default. */
  pattern: imageRef.optional(),
  colors: z.object({
    primary: hexColor,
    secondary: hexColor.optional(),
    accent: hexColor.optional(),
  }),
  fontPair: z.enum(FONT_PAIRS).default("inter"),
  radius: z.enum(["none", "sm", "md", "lg", "full"]).default("md"),
  buttonStyle: z.enum(["solid", "outline", "pill"]).default("solid"),
  density: z.enum(["compact", "comfortable", "spacious"]).default("comfortable"),
  mode: z.enum(["light", "dark"]).default("light"),
  /** How highlighted words stand out: in the brand color, or by weight (light heading, bold highlight). */
  /** "underline" adds a brand-colored underline to the bold highlight, as in many creators' posts. */
  /** "marker": the highlight sits on a block of the brand color, like a marker pen (corporate/environmental look). */
  /** "italic": regular-weight headings with the highlight in italics, as in a newspaper or a law firm's letterhead. */
  headlineStyle: z.enum(["accent", "weight", "underline", "plain", "outline", "marker", "italic"]).default("accent"),
  /**
   * "expressive": motion and effects (word-by-word titles, slow zoom, glowing icon tiles).
   * "editorial": sober and static, for brands that must not look like a template.
   * "layered": static like editorial, with dark panels cut by large rounded corners,
   *   soft brand gradients, translucent cards with fine brand borders (SaaS/fintech look).
   * "impacto": all-dark site, uppercase wide headings with the keyword in the brand
   *   color, dashed eyebrows, fine-bordered dark cards and a faint grid (agency look).
   * "academia": gym look. Dark site, big condensed uppercase headings, photo-led
   *   cards, solid bands in the brand color, plain icons and the featured plan
   *   filled with the brand color.
   * "ambiental": corporate environmental look. Uppercase bold headings in the
   *   dark tone, curved bands in a primary→secondary gradient between sections
   *   and across the cover, pill eyebrows, rounded photo panels and soft
   *   diagonal stripes on light bands.
   * "engenharia": engineering catalog look. Black and warm off-white bands,
   *   photos inside circles with a graduated dial ring and a numbered red dot,
   *   mono red labels, stats in circles (the last one filled) and a single red
   *   accent.
   * "promotora": event promoter. Photo-led, deep brand bands with thin
   *   dividers between big numbers, the logo's geometric shapes (half discs)
   *   overlapping photos, event calendar cards and bold rounded headings.
   * "feira": trade fairs of the print and packaging industry. Three gestures:
   *   layers (offset planes behind photos), cut-outs (cards with one
   *   label-like cut corner) and connections (a line ending in a dot before
   *   eyebrows); mineral bands between white ones.
   * "faceta": the cut of a logo letter as the motif (e.g. Furnax's "x"): a slanted
   *   accent facet before eyebrows and on card corners, machines on light
   *   plinths, deep bands with a large diagonal plane.
   * "moldura": machinery catalog in the manner of gmfinishing.com. Light grey
   *   page with a "+" grid, thick corner brackets before headings and around
   *   buttons, curved bases on photos and panels, product cards with a deep
   *   header, italic quotes.
   * "classico": a plain corporate site in the manner of a classic WordPress build:
   *   the brand's own colour only, small rectangular buttons, simple headings
   *   with a plain eyebrow, rounded photos, a home hero with rounded bottom
   *   corners and pale tinted bands between white ones. No decorative accents.
   * "banca": a leading law firm. Ivory and white bands with deep ink ones, hairline
   *   rules instead of cards, square corners, small letterspaced eyebrows after a short
   *   accent rule, serif headings, portraits in black and white (colour on hover) and
   *   practice areas as a ruled index.
   * "corporativo": a modern full-service firm, in the manner of bvalaw.com.br: deep navy gradient
   *   bands, bold italic headings with the highlight in the accent colour, rounded cards with an accent
   *   rule on top, pill buttons, a sticky dark header, the team as a sideways carousel and plenty of
   *   scroll motion.
   * "executivo": a personal-brand consultant or speaker, in the manner of gustavocerbasi.com.br: dark
   *   bands over soft, blurred photos with a gradient that deepens behind the text, bands in a
   *   brand→dark gradient, the brand's symbol drawn large behind the person in the hero (hero `mark`)
   *   and static photos.
   * "nuvem": a SaaS product page in the manner of salesforce.com/br/crm: white page, sky-blue gradient bands,
   *   deep navy headings in a bold sans, pill buttons, white cards with a soft shadow and a coloured strip on top
   *   (each item's own `accent`, e.g. one colour per product), photos and screens with large rounded corners.
   * "vila": a cartoon world for kids-style and animated brands. Paper background, thick ink outlines, cards as
   *   stickers with a hard offset shadow, buttons that press down, white headings with an ink outline in the
   *   manner of video captions, bright colour bands and playful motion.
   */
  style: z.enum(["expressive", "editorial", "layered", "impacto", "industrial", "academia", "ambiental", "engenharia", "promotora", "feira", "faceta", "moldura", "classico", "banca", "corporativo", "executivo", "vila", "nuvem"]).default("expressive"),
  /** A thin bar above the header with the phone, e-mail, WhatsApp and social links (in the brand color). */
  topBar: z.boolean().default(false),
  /**
   * Dark headers with a light logo are the norm for premium professional-services sites.
   * "overlay": transparent over the page's opening photo (light logo and links), scrolling away with it;
   * on a page that does not open with a photo hero it falls back to a solid dark header.
   */
  header: z.enum(["light", "dark", "overlay"]).default("light"),
  /** "dark": the footer in the dark tone even on styles that paint it in the brand colour (e.g. "classico"). */
  footerTone: z.enum(["auto", "dark"]).default("auto"),
  /** Dark tone used by "dark" bands, header and footer. Defaults to a neutral near-black. */
  dark: hexColor.optional(),
  /** Header button; landing pages point it at the offer (e.g. "Comprar o livro"). Default: "Fale conosco". */
  headerCta: cta.optional(),
  /** No button in the header: the menu alone, as on a site whose calls to action live in the page. */
  hideHeaderCta: z.boolean().default(false),
  /** Phones only: a bar fixed at the foot of the screen with up to two buttons (e.g. "Planilha grátis" and "E-book"). */
  mobileBar: z.array(z.object({ label: shortText(40), href })).max(2).default([]),
  /** The business name beside the logo in the header and footer, for a logo that is only a symbol (e.g. a mascot). */
  showNameWithLogo: z.boolean().default(false),
  /** A slim row above the menu, inside the header: the social icons on the left and these small links on the right. */
  utilityLinks: z.array(z.object({ label: shortText(40), href })).max(6).default([]),
  /** Columns of links in the footer, in place of the automatic page list and contacts. */
  footerColumns: z
    .array(z.object({ title: shortText(40), links: z.array(z.object({ label: shortText(60), href })).min(1).max(12) }))
    .max(4)
    .default([]),
});

export const business = z.object({
  /** "person" for personal-brand sites: search engines and AI assistants then describe a person, not a company. */
  entityType: z.enum(["organization", "person"]).default("organization"),
  name: shortText(120),
  /** For a person: role shown to search engines, e.g. "Fundador da Agência Everest". */
  jobTitle: optionalText(120),
  /** For a person: the company they lead or work for. */
  worksFor: z.object({ name: shortText(120), url: href.optional() }).optional(),
  tagline: optionalText(160),
  logo: imageRef.optional(),
  /** Logo version for dark backgrounds (header/footer in dark mode). */
  logoOnDark: imageRef.optional(),
  favicon: imageRef.optional(),
  phone: phoneDigits.optional(),
  email: z.email().max(200).optional(),
  whatsapp: z
    .object({
      number: phoneDigits,
      defaultMessage: optionalText(300),
      floatingButton: z.boolean().default(true),
      /**
       * Before a WhatsApp link opens, a short form asks for name, WhatsApp and e-mail: the contact becomes a lead
       * (panel, e-mail and the client's CRM) even if the conversation never starts. Asked once per visitor.
       */
      leadCapture: z.boolean().default(true),
      /** The same form also asks what the visitor wants (required); it goes into the lead and opens the chat. */
      askMessage: z.boolean().default(false),
    })
    .optional(),
  address: z
    .object({
      street: optionalText(200),
      city: shortText(80),
      state: z.string().regex(/^[A-Z]{2}$/, "Use a sigla do estado, ex.: SP"),
      postalCode: z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido").optional(),
    })
    .optional(),
  socials: z
    .object({
      instagram: href.optional(),
      facebook: href.optional(),
      linkedin: href.optional(),
      youtube: href.optional(),
      tiktok: href.optional(),
    })
    .prefault({}),
  /** Shown as written, e.g. "Segunda a sexta, das 9h às 17h30". */
  openingHours: optionalText(160),
  /** The same hours for search engines and maps (Schema.org openingHoursSpecification): days and opening times. */
  hours: z
    .array(
      z.object({
        days: z.array(z.enum(["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"])).min(1).max(7),
        opens: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM"),
        closes: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM"),
      }),
    )
    .max(7)
    .default([]),
  /** Where the business is on the map (Schema.org geo), from a geocoder or the map pin: helps local search. */
  geo: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
  /** A fixed notice above the footer's last line, e.g. "Conteúdo educativo, sem recomendação de investimento". */
  footerNotice: optionalText(400),
  /** Facts for search engines and AI assistants (Schema.org): keep them true and verifiable. */
  foundingYear: z.number().int().min(1800).max(2100).optional(),
  areasServed: z.array(shortText(80)).max(20).default([]),
  /** Topics the business is knowledgeable about, e.g. "Direito penal empresarial". */
  expertise: z.array(shortText(80)).max(20).default([]),
  /** Legal-profession advertising rules (OAB Provimento 205/2021): templates hide sensitive sections. */
  complianceMode: z.enum(["none", "oab"]).default("none"),
});

/** IDs only, validated by pattern: they are interpolated into third-party script tags. */
export const integrations = z
  .object({
    ga4: z.string().regex(/^G-[A-Z0-9]{4,12}$/, "ID do GA4 no formato G-XXXXXXX").optional(),
    gtm: z.string().regex(/^GTM-[A-Z0-9]{4,10}$/, "ID do GTM no formato GTM-XXXXXX").optional(),
    metaPixel: z.string().regex(/^\d{10,20}$/, "ID do Meta Pixel (somente números)").optional(),
    /** RD Station Marketing tracking code: the id in ".../loader-scripts/<id>-loader.js". */
    rdStation: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, "Código do RD Station no formato xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx").optional(),
    /** Content of Search Console's HTML-tag verification, kept so the property stays verified after a migration. */
    googleVerification: z.string().regex(/^[A-Za-z0-9_-]{20,80}$/, "Cole só o código do content da meta tag do Google").optional(),
  })
  .prefault({});

export const pageSeo = z
  .object({
    title: optionalText(70),
    description: optionalText(170),
    ogImage: imageRef.optional(),
    noindex: z.boolean().default(false),
    /**
     * What the page is, for Schema.org: a service page becomes a Service
     * offered by the business, so search engines and AI answers can tell
     * which page describes which offer.
     */
    kind: z.enum(["page", "service", "about", "contact", "guide"]).optional(),
  })
  .prefault({});

export const page = z.object({
  /**
   * "" is the home page; others are kebab-case path segments ("sobre", "servicos").
   * One level of nesting ("solucoes/seo") keeps a migrated site's URLs as they were.
   */
  slug: z
    .string()
    .regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/, "Use letras minúsculas, números e hífen (no máximo um nível: pai/filho)"),
  title: shortText(80),
  showInMenu: z.boolean().default(true),
  /** A page kept out of the main menu but linked in the footer (ombudsman, whistleblowing channel, careers). */
  showInFooter: z.boolean().default(false),
  /** A single-goal page (ads, campaigns): its header keeps the logo and the button, without the menu links. */
  landing: z.boolean().default(false),
  /** Links shown under this page in the menu, e.g. "Expositores" → "/flexo-labels-expo#expositores". */
  menuChildren: z.array(z.object({ label: shortText(40), href })).max(8).default([]),
  /** A large panel under this page in the menu: an optional image on the left and groups of links in columns. */
  megaMenu: z
    .object({
      image: imageRef.optional(),
      groups: z
        .array(z.object({ title: shortText(60), href: href.optional(), links: z.array(z.object({ label: shortText(60), href })).min(1).max(16) }))
        .min(1)
        .max(8),
    })
    .optional(),
  seo: pageSeo,
  sections: z.array(section).max(30),
});

export const siteContent = z
  .object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    theme,
    business,
    integrations,
    seo: z.object({
      /** Default title suffix and description for pages without their own. */
      title: shortText(70),
      description: optionalText(170),
      ogImage: imageRef.optional(),
    }),
    // Room for a page per practice area or product line (a law firm with 23 areas, a catalog by segment).
    pages: z.array(page).min(1).max(120),
    /** Extra languages, in the order shown in the switcher. Portuguese (pt-BR) is always the main one. */
    languages: z.array(z.enum(["en", "es", "ja"])).max(3).default([]),
    blog: blogConfig.optional(),
  })
  .superRefine((site, ctx) => {
    site.pages.forEach((p, i) =>
      p.sections.forEach((s, j) => {
        // In a statement the emphasis falls on the big sentence; everywhere else, on the heading.
        const target = s.type === "statement" ? s.text : s.heading;
        if (s.highlight && !target?.includes(s.highlight)) {
          const where = s.type === "statement" ? "do texto" : "do título";
          ctx.addIssue({ code: "custom", message: `O destaque precisa ser um trecho ${where}`, path: ["pages", i, "sections", j, "highlight"] });
        }
        if (s.type === "tool" && s.variant === "quiz" && s.questions.length < 2)
          ctx.addIssue({ code: "custom", message: "O diagnóstico precisa de pelo menos 2 perguntas", path: ["pages", i, "sections", j, "questions"] });
        if (s.type === "ranges") {
          const groups = new Set(s.groups.map((g) => g.id));
          s.rows.forEach((r, k) => {
            if (!groups.has(r.group)) ctx.addIssue({ code: "custom", message: `Grupo inexistente: ${r.group}`, path: ["pages", i, "sections", j, "rows", k, "group"] });
            if (r.to < r.from) ctx.addIssue({ code: "custom", message: "O fim da faixa precisa ser maior que o início", path: ["pages", i, "sections", j, "rows", k, "to"] });
          });
        }
        if (s.type === "tool" && s.variant === "checklist" && s.items.length < 2)
          ctx.addIssue({ code: "custom", message: "O checklist precisa de pelo menos 2 itens", path: ["pages", i, "sections", j, "items"] });
      }),
    );
    const slugs = new Set<string>();
    site.pages.forEach((p, i) => {
      if (slugs.has(p.slug)) ctx.addIssue({ code: "custom", message: `Página duplicada: /${p.slug}`, path: ["pages", i, "slug"] });
      slugs.add(p.slug);

      const ids = new Set<string>();
      p.sections.forEach((s, j) => {
        if (ids.has(s.id)) ctx.addIssue({ code: "custom", message: `Seção duplicada: #${s.id}`, path: ["pages", i, "sections", j, "id"] });
        ids.add(s.id);
      });
    });
    if (!slugs.has("")) ctx.addIssue({ code: "custom", message: "O site precisa de uma página inicial", path: ["pages"] });
  });

export type SiteContent = z.infer<typeof siteContent>;
export type Page = z.infer<typeof page>;
export type Theme = z.infer<typeof theme>;

type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;

/** MIGRATIONS[n] upgrades a version-n document to version n + 1. */
const MIGRATIONS: Record<number, Migration> = {};

/**
 * Validates stored content, upgrading documents saved under older schema
 * versions first. Throws a ZodError listing every problem when invalid.
 */
export function parseSiteContent(input: unknown): SiteContent {
  let doc = input as Record<string, unknown>;
  let version = typeof doc?.schemaVersion === "number" ? doc.schemaVersion : CURRENT_SCHEMA_VERSION;
  while (version < CURRENT_SCHEMA_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) throw new Error(`No content migration from schema version ${version}`);
    doc = { ...migrate(doc), schemaVersion: version + 1 };
    version += 1;
  }
  return siteContent.parse(doc);
}
