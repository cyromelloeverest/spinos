import { z } from "zod";

/*
 * Building blocks shared by every section. Site content is typed by
 * operators and rendered on public sites, so every string is length-limited
 * and every link is restricted to safe schemes — this is where XSS is
 * stopped, not in the templates.
 */

export const shortText = (max = 120) => z.string().trim().min(1).max(max);
export const optionalText = (max: number) => z.string().trim().max(max).optional();

/** Plain paragraphs. Line breaks are kept; no markup is ever interpreted. */
export const paragraph = (max = 1200) => z.string().trim().min(1).max(max);

export const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor no formato #RRGGBB")
  .transform((value) => value.toLowerCase());

/** Internal paths ("/contato", "#servicos") or external links with safe schemes only. */
export const href = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    if (value.startsWith("/") && !value.startsWith("//")) return true;
    if (value.startsWith("#")) return true;
    try {
      const url = new URL(value);
      return ["https:", "http:", "mailto:", "tel:"].includes(url.protocol);
    } catch {
      return false;
    }
  }, "Link inválido: use /pagina, #secao, https://, mailto: ou tel:");

export const cta = z.object({
  label: shortText(40),
  /** `whatsapp` opens the site's WhatsApp with its default message. */
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("link"), href }),
    z.object({ type: z.literal("whatsapp"), message: optionalText(300) }),
  ]),
  /** "whatsapp": the button in WhatsApp green instead of the brand color (e.g. the closing call of a landing page). */
  color: z.enum(["whatsapp"]).optional(),
});
export type Cta = z.infer<typeof cta>;

/** Reference to an uploaded asset; resolved to CDN URLs when the site is published. */
export const imageRef = z.object({
  assetId: z.uuid(),
  alt: z.string().trim().max(200),
});
export type ImageRef = z.infer<typeof imageRef>;

/**
 * Brazilian phone normalized to digits with country code: 5511987654321.
 * Operators usually type "(11) 98765-4321", so a bare DDD + number gets 55 prepended.
 */
export const phoneDigits = z
  .string()
  .transform((value) => {
    const digits = value.replace(/\D/g, "");
    return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  })
  .pipe(z.string().regex(/^55\d{10,11}$/, "Use DDD + número, ex.: (11) 98765-4321"));

export const sectionId = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,39}$/, "Use letras minúsculas, números e hífen");
