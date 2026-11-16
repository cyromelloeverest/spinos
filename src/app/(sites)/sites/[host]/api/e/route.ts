import { createHmac } from "node:crypto";
import { z } from "zod";
import { createWindowLimiter } from "@/lib/sites/window-limiter";
import { analyticsKey } from "@/lib/sites/env";
import { loadSite } from "@/lib/sites/source";
import { saveSiteEvent } from "@/lib/sites/events";

/*
 * First-party analytics beacon (no cookies, no personal data). The browser
 * sends page views, conversion clicks and Core Web Vitals; the site comes
 * from the host segment, never from the payload.
 */

const ms = z.number().int().min(0).max(120_000).nullish();
const text = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null);

const beacon = z.object({
  k: z.enum(["view", "click", "vitals"]),
  p: z.string().max(300).regex(/^\/[^\s]*$/),
  r: z.string().max(500).nullish(),
  us: text(100),
  um: text(100),
  uc: text(100),
  // "game": a site's interactive content (e.g. a mini-game) reporting its own moments as /path/event clicks.
  // Engagement only: not a conversion and not shown on the panel's click cards.
  l: z.enum(["whatsapp", "phone", "email", "cta", "outbound", "form", "game"]).nullish(),
  v: z.object({ lcp: ms, inp: ms, cls: z.number().min(0).max(10).nullish(), ttfb: ms, fcp: ms }).nullish(),
});

// A real page sends a handful of beacons; this only brakes a script that floods the endpoint (per instance, see createWindowLimiter).
const allowBeacon = createWindowLimiter({ limit: 120, windowMs: 60_000 });

const BOTS = /bot|crawl|spider|slurp|preview|lighthouse|headless|pagespeed|gtmetrix|facebookexternalhit|monitor/i;

export async function POST(request: Request, { params }: { params: Promise<{ host: string }> }) {
  const { host } = await params;
  const ua = request.headers.get("user-agent") ?? "";
  const done = new Response(null, { status: 204 });
  if (host.endsWith(".localhost") || BOTS.test(ua)) return done;

  const raw = await request.text();
  if (raw.length > 2000) return done;
  let parsed;
  try {
    parsed = beacon.safeParse(JSON.parse(raw));
  } catch {
    return done;
  }
  if (!parsed.success) return done;
  const e = parsed.data;

  const result = await loadSite(host);
  if (result.status !== "found") return done;
  const { site } = result;

  const visitor = visitorId(request, site.siteId, ua);
  if (!allowBeacon(visitor)) return done;

  await saveSiteEvent({
    organizationId: site.organizationId,
    siteId: site.siteId,
    kind: e.k,
    // Query strings can carry personal data (e-mails in links): only the path is kept.
    path: e.p.split(/[?#]/)[0]!.slice(0, 200),
    visitor,
    referrerHost: referrerHost(e.r, request.headers.get("host") ?? host),
    utmSource: e.us,
    utmMedium: e.um,
    utmCampaign: e.uc,
    device: device(ua),
    country: request.headers.get("x-vercel-ip-country")?.slice(0, 2) ?? null,
    label: e.k === "click" ? (e.l ?? null) : null,
    lcp: e.v?.lcp ?? null,
    inp: e.v?.inp ?? null,
    cls: e.v?.cls == null ? null : Math.round(e.v.cls * 1000),
    ttfb: e.v?.ttfb ?? null,
    fcp: e.v?.fcp ?? null,
  });
  return done;
}

/** Same visitor, same site, same day → same id; tomorrow it changes. The IP itself is never stored. */
function visitorId(request: Request, siteId: string, ua: string): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const day = new Date().toISOString().slice(0, 10);
  return createHmac("sha256", analyticsKey() ?? "dev").update(`${day}|${siteId}|${ip}|${ua}`).digest("base64url").slice(0, 22);
}

/** External origin only: navigation inside the same site is not a traffic source. */
function referrerHost(referrer: string | null | undefined, ownHost: string): string | null {
  if (!referrer) return null;
  try {
    const hostname = new URL(referrer).hostname.replace(/^www\./, "");
    return hostname && hostname !== ownHost.replace(/^www\./, "") ? hostname.slice(0, 120) : null;
  } catch {
    return null;
  }
}

function device(ua: string): string {
  if (/ipad|tablet|kindle|silk|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}
