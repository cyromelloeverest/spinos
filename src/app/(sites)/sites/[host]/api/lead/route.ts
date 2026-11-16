import { createHash } from "node:crypto";
import { z } from "zod";
import { spamCheck } from "@/lib/sites/spam";
import { analyticsKey } from "@/lib/sites/env";
import { loadSite } from "@/lib/sites/source";
import { allowLead } from "@/lib/sites/events";
import { saveLead } from "@/lib/sites/inquiry";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullish();

/** Ad click attribution written by the browser (components/attribution.ts); anything malformed is dropped. */
const clickId = z.string().regex(/^[A-Za-z0-9._-]{1,300}$/).optional().catch(undefined);
const attributionField = z
  .string()
  .max(2000)
  .transform((raw) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  })
  .pipe(
    z
      .object({
        gclid: clickId,
        gbraid: clickId,
        wbraid: clickId,
        fbclid: clickId,
        fbc: clickId,
        fbp: clickId,
        landingPage: z.string().max(200).regex(/^\/[^\s]*$/).optional().catch(undefined),
        referrer: z.string().max(253).regex(/^[a-z0-9.-]+$/i).optional().catch(undefined),
        firstSeenAt: z.iso.datetime().optional().catch(undefined),
      })
      .nullable()
      .catch(null),
  )
  .transform((a) => (a ? Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined)) : null))
  .optional()
  .catch(undefined);

const leadFields = z
  .object({
    name: z.string().trim().max(120),
    company: optional(120),
    phone: optional(30),
    email: z
      .union([z.literal(""), z.email().max(200)])
      .transform((v) => v || null)
      .nullish(),
    message: optional(2000),
    /** What the visitor filled in the page's tools, written by the browser. */
    context: optional(1500),
    // A path on this site: "//x" would be read as another host by the redirect below.
    page: z.string().max(200).regex(/^\/(?!\/)[a-z0-9/-]*$/).catch("/"),
    section: z.string().max(40).regex(/^[a-z0-9-]+$/).catch("contato"),
    /** Which form sent it: the contact form, a newsletter, a course waiting list or the form before WhatsApp. */
    intent: z.enum(["contato", "newsletter", "lista-de-espera", "whatsapp"]).catch("contato"),
    website: z.string().max(0).optional(),
    /** When the page opened (ms since epoch), written by the browser on submit. */
    ts: z.coerce.number().int().positive().optional().catch(undefined),
    attr: attributionField,
  });
const leadForm = leadFields
  .refine((f) => f.name.length > 0, { message: "Informe o nome" })
  .refine((f) => f.phone || f.email, { message: "Informe telefone ou e-mail" })
  .refine((f) => f.intent !== "whatsapp" || f.phone, { message: "Informe o WhatsApp" });
/** A reporting channel: nothing identifies the sender unless they choose to. */
const anonymousForm = leadFields.transform((f) => ({ ...f, name: f.name || "Anônimo", intent: "contato" as const }));

/**
 * Receives the plain-HTML lead form. The tenant comes from the host segment
 * (set by proxy.ts from the Host header), never from the submitted data.
 */
export async function POST(request: Request, { params }: { params: Promise<{ host: string }> }) {
  const { host } = await params;
  const result = await loadSite(host);
  if (result.status !== "found") return new Response("Not found", { status: 404 });

  const form = Object.fromEntries((await request.formData()).entries());
  const sectionId = typeof form.section === "string" && /^[a-z0-9-]{1,40}$/.test(form.section) ? form.section : "contato";
  // Anonymity is never taken from the form: only a contact section the site set up as anonymous allows it.
  const anonymous = result.site.content.pages.some((p) => p.sections.some((s) => s.type === "contact" && s.id === sectionId && s.anonymous));
  // A form's further questions: only those the section itself declares are read, and they reach the message as "Cargo: x".
  const asked = result.site.content.pages.flatMap((p) => p.sections).find((s) => s.type === "contact" && s.id === sectionId);
  const extraAnswers = asked?.type === "contact" ? asked.extraFields.flatMap((f) => {
    const value = form[`extra_${f.name}`];
    return typeof value === "string" && value.trim() ? [`${f.label}: ${value.trim().slice(0, 200)}`] : [];
  }) : [];
  // A sign-up form: its own consent checkbox, an e-mail-only list and the material it delivers come from the section, never from the form.
  const signUp = result.site.content.pages.flatMap((p) => p.sections).find((s) => s.type === "newsletter" && s.id === sectionId);
  const newsletter = signUp?.type === "newsletter" ? signUp : null;
  if (newsletter?.emailOnly && typeof form.email === "string" && !(typeof form.name === "string" && form.name.trim())) form.name = form.email.split("@")[0] ?? "";
  const parsed = (anonymous ? anonymousForm : leadForm).safeParse(form);
  // A site that asks for the message before WhatsApp: a contact without it is refused, like any missing field.
  const needsMessage = result.site.content.business.whatsapp?.askMessage === true;
  // The section id travels back so only the form that was sent shows the result.
  const back = (query: string, anchor: string) =>
    Response.redirect(new URL(`${parsed.success ? parsed.data.page : "/"}?${query}&secao=${anchor}#${anchor}`, publicOrigin(request, host)), 303);

  // Honeypot filled in: pretend success so bots learn nothing.
  if (typeof form.website === "string" && form.website !== "") return back("enviado=1", sectionId);
  if (!parsed.success) return back("erro=1", sectionId);
  if (needsMessage && parsed.data.intent === "whatsapp" && !(parsed.data.message && parsed.data.message.length >= 3)) return back("erro=1", sectionId);
  if (newsletter?.consentText && form.consent !== "on") return back("erro=1", sectionId);

  const lead = parsed.data;
  const ipHash = hashIp(request);
  // Too many forms from this visitor or for this site: the visitor sees the same error as any failed send.
  if (!(await allowLead(result.site.siteId, ipHash))) return back("erro=1", sectionId);
  const utm = utmFromReferer(request, host);
  // Spam is saved but quarantined (source "spam"): the panel files it as discarded and sends no notice.
  const elapsedMs = lead.ts ? Date.now() - lead.ts : null;
  const verdict = spamCheck({ ...lead, elapsedMs: elapsedMs !== null && elapsedMs >= 0 && elapsedMs < 86_400_000 ? elapsedMs : null });
  const message =
    [lead.intent === "whatsapp" && !lead.message ? "Deixou o contato antes de abrir uma conversa no WhatsApp." : null, newsletter?.material ? `Pediu: ${newsletter.material.title}.` : null, extraAnswers.join("\n") || null, lead.message, lead.context && `Respostas nas ferramentas:\n${lead.context}`]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 3600) || null;
  await saveLead({
    organizationId: result.site.organizationId,
    siteId: result.site.siteId,
    host,
    name: lead.name,
    company: lead.company,
    phone: lead.phone,
    email: lead.email,
    message,
    pagePath: lead.page,
    source: verdict.spam ? "spam" : lead.intent !== "contato" ? lead.intent : utm.source || fromAd(lead.attr) ? "campanha" : "site",
    // Uma denúncia anônima não guarda dado de navegação (o hash do IP só limita envios).
    utmSource: anonymous ? null : utm.source,
    utmMedium: anonymous ? null : utm.medium,
    utmCampaign: anonymous ? null : utm.campaign,
    ipHash: anonymous ? null : ipHash,
    attribution: !anonymous && lead.attr && Object.keys(lead.attr).length > 0 ? lead.attr : null,
    consentText: newsletter?.consentText ?? null,
  });

  // Spam sees a plain "sent" message: no "obrigado", so it never counts as a conversion in Ads/Meta.
  if (verdict.spam) return back("enviado=1", sectionId);
  // "obrigado" in the URL: the thank-you signal tag managers already look for; t makes each lead unique (no double count on reload).
  // A material goes on to its thank-you page, whose downloads section starts the file.
  const thanks = newsletter?.material?.thankYouPath;
  if (thanks?.startsWith("/") && !thanks.startsWith("//")) {
    return Response.redirect(new URL(`${thanks}?obrigado=1&tipo=${lead.intent}&t=${Date.now().toString(36)}`, publicOrigin(request, host)), 303);
  }
  return back(`obrigado=1&tipo=${lead.intent}&t=${Date.now().toString(36)}`, lead.section);
}

/** A Google or Meta ad click came with the form. */
function fromAd(attr: Record<string, unknown> | null | undefined): boolean {
  return Boolean(attr && (attr.gclid || attr.gbraid || attr.wbraid || attr.fbclid));
}

/** The form posts from the page the visitor landed on, so its URL still carries the UTM tags. */
function utmFromReferer(request: Request, host: string) {
  try {
    const referer = new URL(request.headers.get("referer") ?? "");
    const sameSite = referer.hostname === host || referer.hostname.endsWith(".localhost");
    if (!sameSite) return { source: null, medium: null, campaign: null };
    const get = (key: string) => referer.searchParams.get(key)?.slice(0, 100) || null;
    return { source: get("utm_source"), medium: get("utm_medium"), campaign: get("utm_campaign") };
  } catch {
    return { source: null, medium: null, campaign: null };
  }
}

function hashIp(request: Request): string | null {
  const salt = analyticsKey();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!salt || !ip) return null;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/** Redirect back to the host the visitor used (the rewritten request URL carries the internal path). */
function publicOrigin(request: Request, host: string): string {
  const visible = request.headers.get("host") ?? host;
  const proto = request.headers.get("x-forwarded-proto") ?? (visible.includes("localhost") ? "http" : "https");
  return `${proto}://${visible}`;
}
