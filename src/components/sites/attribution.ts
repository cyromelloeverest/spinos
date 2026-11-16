/*
 * Ad click attribution: which Google or Meta ad brought the visitor, so a sale
 * closed later in the CRM can be reported back to the ad platform as an
 * offline conversion.
 *
 * - For the visit (sessionStorage): the click identifier from the landing URL,
 *   so a visitor who lands on /oferta?gclid=… and writes on /contato is still
 *   attributed. It disappears when the tab closes.
 * - For 90 days (localStorage): only with marketing consent, for visitors who
 *   come back later to fill the form.
 * The identifiers travel only with a form the visitor chooses to send.
 */

const SESSION_KEY = "es-attr";
const KEEP_KEY = "es-attr-90d";
const KEEP_MS = 90 * 86_400_000;
const CLICK_KEYS = ["gclid", "gbraid", "wbraid", "fbclid"] as const;
const SAFE = /^[A-Za-z0-9._-]{1,300}$/;

export type Attribution = Partial<Record<(typeof CLICK_KEYS)[number] | "fbc" | "fbp" | "landingPage" | "referrer" | "firstSeenAt", string>>;

function read(storage: Storage, key: string): Attribution | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Attribution & { expires?: number };
    if (value.expires && value.expires < Date.now()) {
      storage.removeItem(key);
      return null;
    }
    delete value.expires;
    return value;
  } catch {
    return null;
  }
}

function marketingConsent(): boolean {
  try {
    return (JSON.parse(localStorage.getItem("es-consent-v1") ?? "null") as { marketing?: boolean } | null)?.marketing === true;
  } catch {
    return false;
  }
}

function cookie(name: string): string | undefined {
  return document.cookie.split("; ").find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1);
}

/** On every page view: a new ad click in the URL replaces the stored one. */
export function captureAttribution(): void {
  try {
    const params = new URLSearchParams(location.search);
    const click: Attribution = {};
    for (const key of CLICK_KEYS) {
      const value = params.get(key);
      if (value && SAFE.test(value)) click[key] = value;
    }
    if (Object.keys(click).length === 0) {
      // No ad click now: keep what this visit already has, or bring back a consented one.
      if (!sessionStorage.getItem(SESSION_KEY) && marketingConsent()) {
        const kept = read(localStorage, KEEP_KEY);
        if (kept) sessionStorage.setItem(SESSION_KEY, JSON.stringify(kept));
      }
      return;
    }
    let referrer: string | undefined;
    try {
      referrer = document.referrer ? new URL(document.referrer).hostname : undefined;
    } catch {
      referrer = undefined;
    }
    const value: Attribution = { ...click, landingPage: location.pathname.slice(0, 200), firstSeenAt: new Date().toISOString(), ...(referrer ? { referrer } : {}) };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
    if (marketingConsent()) localStorage.setItem(KEEP_KEY, JSON.stringify({ ...value, expires: Date.now() + KEEP_MS }));
  } catch {
    // Storage blocked (private mode): the form still works, without attribution.
  }
}

/** What goes with a form: the stored click plus Meta's browser identifiers when the Pixel set them. */
export function attributionForForm(): Attribution | null {
  let value: Attribution = {};
  try {
    value = read(sessionStorage, SESSION_KEY) ?? {};
  } catch {
    value = {};
  }
  // Google's own click cookie (set by the Google tag after consent) when the URL had none.
  const gcl = cookie("_gcl_aw")?.split(".")[2];
  if (!value.gclid && gcl && SAFE.test(gcl)) value.gclid = gcl;
  const fbp = cookie("_fbp");
  const fbc = cookie("_fbc");
  if (fbp && SAFE.test(fbp)) value.fbp = fbp;
  if (fbc && SAFE.test(fbc)) value.fbc = fbc;
  // Meta accepts fbc built from the fbclid when the Pixel has not set the cookie.
  else if (value.fbclid) value.fbc = `fb.1.${Date.parse(value.firstSeenAt ?? "") || Date.now()}.${value.fbclid}`;
  return Object.keys(value).length > 0 ? value : null;
}
