import { z } from "zod";
import { blogBlock } from "./blog";
import { cta, hexColor, href, imageRef, optionalText, paragraph, sectionId, shortText } from "./primitives";

/** Curated line icons (rendered by @everest/sections). Keys, not SVG: content never carries markup. */
export const ICONS = [
  "scale", "shield", "briefcase", "building", "document", "users", "search", "lock", "clock",
  "handshake", "leaf", "truck", "recycle", "chart", "globe", "phone", "check", "compass", "alert", "target",
  "sparkles", "booth", "expand", "award", "calendar", "ticket", "mic", "network", "browser", "palette",
] as const;
export type IconName = (typeof ICONS)[number];
const icon = z.enum(ICONS);

/*
 * The section library. Templates choose which sections they offer and in
 * which order; operators fill the fields. Each section has a few visual
 * variants so a handful of templates can look like many different sites
 * without any client-specific code.
 */

const base = <T extends string, const V extends readonly [string, ...string[]]>(type: T, variants: V) =>
  z.object({
    id: sectionId,
    type: z.literal(type),
    variant: z.enum(variants),
    hidden: z.boolean().default(false),
    /** Anchor title shown in menus and used by "#id" links. */
    heading: optionalText(120),
    /** Part of the heading given emphasis (bolder or in the brand color). Must appear in the heading. */
    highlight: optionalText(80),
    /** Small uppercase label above the heading, e.g. "ÁREAS DE ATUAÇÃO". */
    eyebrow: optionalText(60),
    /** Photo behind the whole section (darkened); cards on top turn translucent. */
    backgroundImage: imageRef.optional(),
    /** Background band. "auto" lets the section pick its own default. */
    tone: z.enum(["auto", "light", "muted", "dark", "brand"]).default("auto"),
    /** This section's own brand color (eyebrow, highlighted words, icons, buttons), e.g. a product with its own color. */
    accent: hexColor.optional(),
  });

const item = z.object({
  title: shortText(80),
  description: optionalText(400),
  image: imageRef.optional(),
  icon: icon.optional(),
  href: href.optional(),
  /** "agenda": this one stands out in the accent colour (e.g. the next event). */
  featured: z.boolean().default(false),
  /** This item's own colour (e.g. one per product): the strip on top of its card in the "nuvem" style. */
  accent: hexColor.optional(),
  /** Benefits "flip": the longer text on the back of the card. */
  back: optionalText(400),
});

/** "scene": a drawn landscape (sky, clouds, hills and houses) with the `images` as cut-out characters standing on the hills and the `mark` floating in the sky; the `callout` title is its speech bubble and the `badges` sit as a proof sticker. */
/** "panels": a catalog cover. Big logo, a spaced tagline and up to 3 diagonal panels with product cut-outs. */
export const heroSection = base("hero", ["split", "background", "centered", "fullscreen", "page", "banners", "portrait", "showcase", "panels", "stage", "flag", "band", "scene"]).extend({
  heading: shortText(120),
  /** "band": the title is kept for search engines and screen readers but not drawn (the page's own title comes right below). */
  headingHidden: z.boolean().default(false),
  /** "band" and "fullscreen": what lies over the photo. "brand" is the theme's deep tone; "dark" a neutral shade; "duotone" tints it from the primary to the accent colour; "none" leaves artwork that already has its own. */
  overlay: z.enum(["brand", "dark", "none", "duotone"]).default("brand"),
  /** Extra photos: with two or more, the hero cross-fades between them with a slow zoom. */
  images: z.array(imageRef).max(5).default([]),
  /** Short trust lines under the buttons, e.g. "Atendimento presencial ou online". */
  badges: z.array(shortText(60)).max(4).default([]),
  /** Long enough for an "about us" opening paragraph on an inner page. */
  subheading: optionalText(480),
  image: imageRef.optional(),
  primaryCta: cta.optional(),
  secondaryCta: cta.optional(),
  /** Brand or product logo shown above the title (e.g. a sub-brand on its own page). */
  logo: imageRef.optional(),
  /** "portrait": the brand's symbol (light, transparent) drawn large behind the person. */
  mark: imageRef.optional(),
  /** "background" and "fullscreen": up to three pillars along the foot of the photo (icon, a spaced label, "Saiba mais"). */
  pillars: z.array(z.object({ label: shortText(30), icon: icon.optional(), href: href })).max(3).default([]),
  /** "showcase": the image in a browser window (a screen) or free-standing (a product render with a transparent background). */
  frame: z.enum(["browser", "none"]).default("browser"),
  /** "flag", "background" and "fullscreen": a muted, looping video behind the headline (YouTube, Vimeo or an https .mp4); the photos stay as its poster. */
  backgroundVideo: href.optional(),
  /** Small glass card floating over the photo, e.g. "Mais que fornecedores. Somos parceiros de decisão." */
  callout: z.object({ title: shortText(60), text: optionalText(80), icon: icon.optional() }).optional(),
});

export const aboutSection = base("about", ["image-left", "image-right", "text-only"]).extend({
  body: paragraph(2000),
  image: imageRef.optional(),
  /**
   * "product": the whole image (e.g. a transparent PNG of a book) on a lit panel, never cropped.
   * "screen": a screenshot of a system or site, in a browser frame at its own proportions.
   */
  /** "whole": the photo at its own proportions, nobody cut off (e.g. a team portrait). */
  imageFit: z.enum(["cover", "product", "screen", "logo", "whole"]).default("cover"),
  /** YouTube or Vimeo link, or an https .mp4 file: shown in place of the photo (the photo becomes the poster). */
  video: href.optional(),
  highlights: z.array(shortText(80)).max(6).default([]),
  cta: cta.optional(),
  secondaryCta: cta.optional(),
});

/** "calendar": event dates, each card with the event logo on top and the date and venue on a brand-colored panel. */
/**
 * "columns": full-width photo columns side by side, each with a title, a line and a button (segments of a catalog).
 * "agenda": a deep band with the heading, intro and `image` on the left and the items as a checked list (e.g. events).
 */
/** "buttons": whole pictures side by side, each with a button under it that names where it leads (a page that splits into choices). */
/** "links": a tight grid of small white cards with a coloured left edge, a name and one line, leading to another page (an equipment index). */
/** "slides": one item at a time, its photo on one side and the text on the other, with tabs and arrows (e.g. the steps of a method). */
export const servicesSection = base("services", ["cards", "list", "icons", "panels", "strip", "numbered", "calendar", "columns", "agenda", "slides", "links", "buttons"]).extend({
  intro: optionalText(400),
  /** "agenda": photo beside the intro. */
  image: imageRef.optional(),
  /** Button label on linked items (default "Saiba mais"). */
  linkLabel: optionalText(30),
  items: z.array(item).min(1).max(12),
});

/** "split": the heading and intro (e.g. the mission) on the left, the items (e.g. the values) beside them, under `listTitle`. */
export const benefitsSection = base("benefits", ["grid", "list", "cards", "split", "flip"]).extend({
  intro: optionalText(400),
  listTitle: optionalText(60),
  /** `image` here is icon artwork (e.g. a 3D icon), shown large in place of the line icon. */
  items: z.array(item.omit({ href: true })).min(1).max(8),
});

export const numbersSection = base("numbers", ["row", "cards", "split"]).extend({
  intro: optionalText(400),
  /** Optional button under the numbers, e.g. "Confira o relatório da edição". */
  cta: cta.optional(),
  items: z
    .array(z.object({ value: shortText(12), label: shortText(160), icon: icon.optional(), image: imageRef.optional() }))
    .min(1)
    .max(6),
});

export const testimonialsSection = base("testimonials", ["cards", "carousel", "split"]).extend({
  /** "split": text and button on the left, a swipeable row of quotes on the right. */
  intro: optionalText(400),
  cta: cta.optional(),
  items: z
    .array(
      z.object({
        quote: paragraph(900),
        author: shortText(80),
        role: optionalText(80),
        photo: imageRef.optional(),
      }),
    )
    .min(1)
    .max(12),
});

/**
 * "badges": official partner/certification seals, shown as provided (own colors and proportions).
 * "sponsors": large equal 16:9 rectangles in a centred grid, for an event's sponsors (logos prepared at 16:9 fill them).
 * "directory": a long list of companies in small tiles, each with its logo, name, one line and a link (a fair's exhibitors).
 */
export const clientsSection = base("clients", ["logos", "logos-grayscale", "strip", "badges", "sponsors", "directory"]).extend({
  intro: optionalText(400),
  logos: z
    // Without a logo (not received yet) the name is shown in its place, in the same tile.
    .array(z.object({
      name: shortText(80),
      logo: imageRef.optional(),
      href: href.optional(),
      /** "directory": a line under the name, e.g. the stand at the fair. */
      note: optionalText(80),
    }))
    .min(1)
    .max(240),
});

export const faqSection = base("faq", ["accordion", "two-columns"]).extend({
  items: z
    .array(z.object({ question: shortText(200), answer: paragraph(1500) }))
    .min(1)
    .max(20),
});

export const ctaSection = base("cta", ["banner", "split", "image", "floating", "inline"]).extend({
  heading: shortText(120),
  body: optionalText(300),
  cta,
  secondaryCta: cta.optional(),
  image: imageRef.optional(),
});

export const contactSection = base("contact", ["form-and-info", "form-only"]).extend({
  intro: optionalText(1500),
  /** Further questions on the form (e.g. "Cargo", "CNPJ"): the answers reach the lead's message, one per line. */
  extraFields: z
    .array(z.object({ name: z.string().regex(/^[a-z][a-z0-9]{1,30}$/), label: shortText(40), required: z.boolean().default(false) }))
    .max(6)
    .default([]),
  /** Asks for the e-mail and the company as required fields, not only as options. */
  requireEmailAndCompany: z.boolean().default(false),
  /** Small line under the button, e.g. "Prometemos não enviar SPAM". */
  formNote: optionalText(200),
  /** "form-and-info": leaves the phone, WhatsApp and e-mail out too: only the text beside the form. */
  hideContacts: z.boolean().default(false),
  /** A faint artwork behind the band (a transparent PNG), unlike `backgroundImage`, which darkens a photo. */
  pattern: imageRef.optional(),
  /** Which optional fields the lead form shows; name and one contact method are always required. */
  fields: z
    .object({
      company: z.boolean().default(false),
      phone: z.boolean().default(true),
      email: z.boolean().default(true),
      message: z.boolean().default(true),
    })
    .prefault({}),
  /** Leaves the address out of the info list, for pages that already show it in a map right below. */
  hideAddress: z.boolean().default(false),
  /** The message field asks what the business needs to qualify the lead, e.g. "Conte sobre o seu negócio". */
  messageLabel: optionalText(60),
  /** Guidance inside the message field, e.g. "Qual o seu segmento e quanto investe hoje em anúncios?". */
  messagePlaceholder: optionalText(200),
  /** Button text, e.g. "Quero meu diagnóstico gratuito" (default "Enviar mensagem"). */
  submitLabel: optionalText(40),
  successMessage: shortText(200).default("Recebemos sua mensagem. Em breve entraremos em contato."),
  /**
   * A reporting channel (whistleblowing, ombudsman): name, phone and e-mail become optional and the report is
   * stored without browsing data. The server honours it only for a section that says so.
   */
  anonymous: z.boolean().default(false),
});

/** "embed": the address card with the Google map itself under it (loaded only when it scrolls near). */
export const mapSection = base("map", ["full-width", "with-address", "embed"]).extend({
  /** Free-text address used for the map search. */
  query: shortText(200),
});

/** Verifiable facts (registrations, education, memberships). Allowed in OAB mode, unlike "numbers". */
export const credentialsSection = base("credentials", ["list", "grid"]).extend({
  intro: optionalText(400),
  items: z
    .array(z.object({ title: shortText(120), detail: optionalText(200) }))
    .min(1)
    // 16: a firm's full scope of work for one practice area can run past a dozen lines.
    .max(16),
});

/** A method or process shown as ordered steps. */
export const stepsSection = base("steps", ["timeline", "cards", "path", "letters"]).extend({
  intro: optionalText(400),
  items: z
    .array(z.object({ title: shortText(80), description: optionalText(400) }))
    .min(2)
    .max(8),
});

export const teamSection = base("team", ["grid", "featured"]).extend({
  intro: optionalText(400),
  members: z
    .array(
      z.object({
        name: shortText(120),
        role: optionalText(80),
        photo: imageRef.optional(),
        /** Professional registration shown as-is, e.g. "OAB/SP 482.249". */
        registration: optionalText(120),
        bio: optionalText(1200),
        linkedin: href.optional(),
      }),
    )
    .min(1)
    .max(24),
});

/** Latest blog posts (optionally one category), e.g. on the home page. */
/**
 * The blog's latest posts. "featured": the newest one large, with its video playing in place (the latest episode of a
 * series), and the next ones beside it. `slugs` picks the posts by hand, in that order (e.g. "start here").
 */
export const postsSection = base("posts", ["cards", "list", "featured"]).extend({
  intro: optionalText(400),
  count: z.number().int().min(1).max(12).default(3),
  category: z.string().max(120).optional(),
  /** Only posts with this tag (e.g. one character's episodes). */
  tag: z.string().max(120).optional(),
  slugs: z.array(z.string().max(120)).max(12).default([]),
  /** Text of the link to the whole blog (default "Ver todos"); empty hides it. */
  linkLabel: optionalText(40),
});

/** Short phrases (e.g. practice areas): scrolling sideways ("text", "outline") or a still index ("grid"). */
/** "photos": a strip of photos scrolling sideways (event coverage, works); `items` are their captions. */
export const marqueeSection = base("marquee", ["text", "outline", "grid", "photos"]).extend({
  items: z.array(shortText(60)).min(2).max(16),
  images: z.array(imageRef).max(16).default([]),
});

/**
 * One large sentence (a manifesto) whose words light up as the visitor scrolls.
 * "portrait": a cut-out portrait in black and white beside the sentence, opened by a large quote mark.
 */
export const statementSection = base("statement", ["reveal", "centered", "portrait"]).extend({
  text: paragraph(400),
  /** "portrait": the person, cut out (transparent PNG). */
  image: imageRef.optional(),
  /** Optional line under the statement, e.g. who says it. */
  caption: optionalText(120),
  cta: cta.optional(),
});

/** Short sign-up (name + e-mail) for a newsletter or a course waiting list; arrives in the panel as a lead. */
/**
 * Name + e-mail sign-up. "product": a sales block for one product (a free material or a paid one still on its
 * waiting list): the image as a tilted sticker beside a card with a badge, the checklist, the price and the form.
 * With `material`, signing up delivers a file: the visitor lands on the thank-you page (where the download starts)
 * and the panel e-mails the link to them.
 */
export const newsletterSection = base("newsletter", ["banner", "card", "product"]).extend({
  body: optionalText(600),
  intent: z.enum(["newsletter", "lista-de-espera"]).default("newsletter"),
  buttonLabel: shortText(40).default("Quero receber"),
  successMessage: shortText(200).default("Pronto! Você está na lista."),
  image: imageRef.optional(),
  /** "product": the image inside a card (a screenshot) or free-standing with a soft shadow (a mockup or cut-out with a transparent background). */
  imageFrame: z.enum(["card", "none"]).default("card"),
  /** "product": small caption under the image, e.g. "A aba Meu Mês, com valores de exemplo". */
  imageCaption: optionalText(120),
  /** "product": sticker over the card, e.g. "GRÁTIS" or "EM BREVE". */
  badge: optionalText(30),
  /** "product": shown as written, e.g. "R$ 19,99". */
  price: optionalText(40),
  priceNote: optionalText(100),
  features: z.array(shortText(140)).max(8).default([]),
  /** Ask only the e-mail (a waiting list). */
  emailOnly: z.boolean().default(false),
  /** A required checkbox with this text (the consent kept as proof, e.g. "Quero receber a planilha e novidades… Posso sair quando quiser."). */
  consentText: optionalText(240),
  /** "product": a purchase button (e.g. the checkout link) in place of the form, once the product is on sale. */
  buyCta: cta.optional(),
  /** A file delivered on sign-up: the thank-you page starts the download and the panel e-mails the link. */
  material: z
    .object({
      /** What the person gets, used in the e-mail, e.g. "Planilha da Dona Formiga". */
      title: shortText(80),
      /** The file: a path on this site (e.g. /arquivos/<site>/planilha.xlsx) or an https link. */
      file: href,
      /** A page of this site (e.g. /obrigado) with a "downloads" section set to start the download. */
      thankYouPath: href,
    })
    .optional(),
});

/** Purchase options side by side (book formats, course plans, ticket types), each with its own button. */
export const offersSection = base("offers", ["cards"]).extend({
  intro: optionalText(400),
  items: z
    .array(
      z.object({
        title: shortText(80),
        description: optionalText(300),
        /** Shown as written, e.g. "R$ 69,90" or "Sob consulta". */
        price: optionalText(40),
        /** Small line under the price, e.g. "Frete calculado no checkout". */
        note: optionalText(80),
        image: imageRef.optional(),
        /** Instead of a photo: a large icon above the name. */
        icon: icon.optional(),
        /** Ribbon on the card, e.g. "Mais escolhido". */
        badge: optionalText(30),
        /** This plan's own colour (e.g. one per product): the strip on top of its card in the "nuvem" style. */
        accent: hexColor.optional(),
        /** What the plan includes, one line each with a check (e.g. "Ativação em até 48h"). */
        features: z.array(shortText(80)).max(10).default([]),
        cta,
      }),
    )
    .min(1)
    .max(4),
});

/** Two columns side by side: the usual way against this business's way ("Antes × Depois"). */
export const comparisonSection = base("comparison", ["columns"]).extend({
  intro: optionalText(400),
  before: z.object({ title: shortText(80), items: z.array(shortText(160)).min(1).max(8) }),
  after: z.object({ title: shortText(80), items: z.array(shortText(160)).min(1).max(8) }),
  cta: cta.optional(),
});

/**
 * Interactive tool that runs in the visitor's browser: a quick diagnostic
 * (Não / Em parte / Sim), a funnel calculator (revenue goal → sales,
 * opportunities, leads) or a checklist. Answers travel with the next lead
 * the visitor sends from the page, so the team sees the context.
 */
export const toolSection = base("tool", ["quiz", "calculator", "checklist", "waste"]).extend({
  intro: optionalText(400),
  /** quiz: the questions, each answered Não / Em parte / Sim. */
  questions: z.array(shortText(200)).max(12).default([]),
  /** quiz: readings by score, each used up to `upTo` percent (the last one should be 100). */
  results: z.array(z.object({ upTo: z.number().int().min(0).max(100), title: shortText(80), text: optionalText(400) })).max(4).default([]),
  /** checklist: the items to tick. */
  items: z.array(shortText(160)).max(16).default([]),
  /** calculator: starting values. */
  defaults: z
    .object({
      goal: z.number().min(0).max(1_000_000_000).default(100_000),
      ticket: z.number().min(1).max(1_000_000_000).default(10_000),
      closeRate: z.number().min(1).max(100).default(25),
      leadRate: z.number().min(1).max(100).default(20),
    })
    .prefault({}),
  /**
   * waste: construction-waste estimate. Built area × m³ of waste per m²,
   * containers needed by size and the split by CONAMA class (A / B / C and D).
   */
  waste: z
    .object({
      area: z.number().min(1).max(10_000_000).default(500),
      perM2: z.number().min(0.01).max(2).default(0.15),
      container: z.number().min(1).max(60).default(4),
      containers: z.array(z.number().min(1).max(60)).min(1).max(6).default([3, 4, 5]),
      classes: z.object({ a: z.number().min(0).max(100), b: z.number().min(0).max(100), cd: z.number().min(0).max(100) }).default({ a: 75, b: 15, cd: 10 }),
    })
    .prefault({}),
  /** Small print under the tool, e.g. "Esta é uma projeção, não uma promessa". */
  note: optionalText(300),
  cta: cta.optional(),
});

const cmykColor = z.enum(["c", "m", "y", "k", "brand"]);

/**
 * A product line (industrial catalog): label, line name, description, one or
 * two cut-out photos and its models, each with short specs. "grid": each model
 * is its own card with photo, text and an optional speed/size meter.
 */
export const modelsSection = base("models", ["split", "grid"]).extend({
  /** Small monospace line above the heading, e.g. "IMPRESSORAS FLEXOGRÁFICAS". */
  kicker: optionalText(60),
  intro: optionalText(600),
  images: z.array(imageRef).max(2).default([]),
  imageSide: z.enum(["left", "right"]).default("left"),
  // "inset": the second photo is smaller, below the first. "equal": both at the same size, for machines of the same weight.
  imageLayout: z.enum(["inset", "equal"]).default("inset"),
  models: z
    .array(
      z.object({
        name: shortText(60),
        /** Anchor of the model's card ("#rebobinadeira"), so links and redirects land on it. */
        anchor: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60).optional(),
        description: optionalText(300),
        specs: z.array(shortText(80)).max(8).default([]),
        image: imageRef.optional(),
        /** A value on a scale, e.g. speed 300–700 of 700 m/min. */
        meter: z
          .object({ from: z.number().min(0).default(0), to: z.number().min(0), max: z.number().positive(), label: shortText(60) })
          .optional(),
        href: href.optional(),
      }),
    )
    .min(1)
    .max(12),
  /** Text of each model's link (default "Ficha técnica"), e.g. "Falar com um especialista". */
  linkLabel: optionalText(40),
  cta: cta.optional(),
});

/** Ranges drawn to scale (e.g. useful width per model, in mm), colored by group. */
export const rangesSection = base("ranges", ["bars"]).extend({
  intro: optionalText(400),
  unit: shortText(12).default("mm"),
  max: z.number().positive(),
  groups: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{1,30}$/), label: shortText(60), color: cmykColor })).min(1).max(6),
  rows: z
    .array(z.object({ label: shortText(60), sub: optionalText(60), from: z.number().min(0), to: z.number().min(0), group: z.string().max(30) }))
    .min(1)
    .max(24),
});

/** Technical sheet: label/value rows, plus the optional items. */
export const specsSection = base("specs", ["table"]).extend({
  intro: optionalText(600),
  image: imageRef.optional(),
  rows: z.array(z.object({ label: shortText(80), value: paragraph(400) })).min(1).max(40),
  optionals: z.array(shortText(160)).max(30).default([]),
  cta: cta.optional(),
});

/**
 * A long text with headings, paragraphs and lists (terms of use, privacy policy, a code of conduct):
 * the same blocks as a blog article, never HTML.
 */
export const documentSection = base("document", ["article"]).extend({
  intro: optionalText(400),
  /** Shown under the text, e.g. "Última atualização: 23 de outubro de 2026". */
  updatedAt: optionalText(80),
  /** "center": the title and the single photos centred over the text, as on a product sheet. */
  align: z.enum(["left", "center"]).default("left"),
  /** Across the page's full width, not a reading column (e.g. a photo gallery). */
  wide: z.boolean().default(false),
  /** May be empty when the title and the intro say it all (e.g. the opening of an index page). */
  body: z.array(blogBlock).max(400),
});

/** A file a visitor saves. `file`, not `href`: its path stays the same in every language of the site. */
const downloadFile = z.object({
  label: shortText(30),
  file: href,
  /** Shown beside the label, e.g. "858 KB". */
  size: optionalText(12),
});

/**
 * Files to save (media kit, press kit, catalogs). "bundle": the page's opening, with the big
 * download-everything button and a fan of previews. "gallery": cards with the preview of each
 * piece. "list": plain rows, for files without a preview.
 */
/** Campaign opening: the name as a poster, the discount huge and a countdown to the last day. */
export const promoSection = base("promo", ["poster"]).extend({
  heading: shortText(120),
  subheading: optionalText(400),
  /** Shown as written, e.g. "20%". */
  discount: shortText(12),
  /** Photo behind the poster, tinted with the brand color and drifting slowly. */
  image: imageRef.optional(),
  /** A muted, looping https .mp4 over the photo, tinted the same way; the photo stays as its poster. */
  backgroundVideo: href.optional(),
  discountLabel: optionalText(20),
  /** Last day of the offer (YYYY-MM-DD); the clock runs until the end of that day in Brasília. */
  deadline: z.iso.date().optional(),
  deadlineLabel: optionalText(60),
  /** Replaces the clock once the offer is over. */
  endedText: optionalText(120),
  primaryCta: cta.optional(),
  secondaryCta: cta.optional(),
  /** Fine print under the buttons. */
  terms: optionalText(240),
});

export const downloadsSection = base("downloads", ["bundle", "gallery", "list"]).extend({
  intro: optionalText(600),
  /** "bundle": short facts under the buttons, e.g. the event's date and place. */
  facts: z.array(shortText(80)).max(4).default([]),
  /** "bundle": the main buttons; the first one stands out. */
  files: z.array(downloadFile).max(4).default([]),
  /** "bundle": up to 3 previews, fanned out beside the text. */
  images: z.array(imageRef).max(3).default([]),
  /** "bundle": on a thank-you page, the first file starts downloading by itself when the visitor arrives from a sign-up form. */
  autoDownload: z.boolean().default(false),
  cta: cta.optional(),
  items: z
    .array(
      z.object({
        title: shortText(80),
        description: optionalText(200),
        image: imageRef.optional(),
        files: z.array(downloadFile).min(1).max(4),
      }),
    )
    .max(24)
    .default([]),
});

/** Ready-made texts with a copy button (captions, e-mail invitations). [Brackets] mark what the reader replaces. */
export const snippetsSection = base("snippets", ["cards"]).extend({
  intro: optionalText(400),
  items: z
    .array(
      z.object({
        title: shortText(80),
        /** When to use it, e.g. "Use com: Feed Estaremos lá". */
        usage: optionalText(120),
        text: paragraph(2000),
        /** The same text in another language, folded under the main one. */
        translation: optionalText(2000),
        translationLabel: optionalText(40),
      }),
    )
    .min(1)
    .max(20),
});

/**
 * The site's latest Instagram posts. They come from the account connected in the panel (Integrações) and refresh
 * every hour; with no account connected, or no posts yet, the block is left out of the page.
 * "grid": a grid of square tiles. "strip": one row that scrolls sideways.
 */
export const instagramSection = base("instagram", ["grid", "strip"]).extend({
  intro: optionalText(400),
  count: z.number().int().min(3).max(12).default(8),
  /** Text of the button to the profile (default "Seguir @perfil"). */
  followLabel: optionalText(40),
});

export const section = z.discriminatedUnion("type", [
  heroSection,
  aboutSection,
  servicesSection,
  benefitsSection,
  numbersSection,
  testimonialsSection,
  clientsSection,
  faqSection,
  ctaSection,
  contactSection,
  mapSection,
  credentialsSection,
  stepsSection,
  teamSection,
  postsSection,
  marqueeSection,
  statementSection,
  newsletterSection,
  offersSection,
  comparisonSection,
  toolSection,
  modelsSection,
  rangesSection,
  specsSection,
  documentSection,
  downloadsSection,
  snippetsSection,
  promoSection,
  instagramSection,
]);

export type Section = z.infer<typeof section>;
export type SectionType = Section["type"];
export const SECTION_TYPES = section.options.map((option) => option.shape.type.value) as SectionType[];
