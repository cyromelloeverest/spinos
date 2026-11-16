"use client";

import { useCallback, useEffect, useState } from "react";

/*
 * LGPD cookie notice and consent, on every site.
 *
 * - Without tracking tools: a short notice (only essential storage is used).
 * - With GA4 / Tag Manager / Meta Pixel: accept all, reject, or choose by
 *   category. Tools load only AFTER consent for their category; nothing is
 *   requested from Google or Meta before that.
 * - The choice stays in this browser (localStorage) and can be changed from
 *   the "Preferências de cookies" link in the footer.
 */

export type Integrations = { ga4?: string; gtm?: string; metaPixel?: string; rdStation?: string };
type Consent = { analytics: boolean; marketing: boolean; at: string; v: 1 };

const KEY = "es-consent-v1";
const OPEN_EVENT_SELECTOR = "[data-cookie-preferences]";

function readConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Consent;
    return parsed.v === 1 ? parsed : null;
  } catch {
    return null;
  }
}

function saveConsent(analytics: boolean, marketing: boolean): Consent {
  const consent: Consent = { analytics, marketing, at: new Date().toISOString(), v: 1 };
  try {
    localStorage.setItem(KEY, JSON.stringify(consent));
  } catch {
    // Private mode: the choice lasts for this page view only.
  }
  return consent;
}

function addScript(id: string, src: string | null, inline?: string) {
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  if (src) {
    s.src = src;
    s.async = true;
  }
  if (inline) s.text = inline;
  document.head.appendChild(s);
}

/** Loads each tool once, only for the categories the visitor allowed. IDs were validated by the content schema. */
function loadTools(tools: Integrations, consent: Consent) {
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
  if (consent.analytics && (tools.ga4 || tools.gtm)) {
    w.dataLayer = w.dataLayer ?? [];
    w.gtag = w.gtag ?? function gtag() {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
    // Google Consent Mode v2: analytics granted, ads follow the marketing choice.
    w.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: consent.marketing ? "granted" : "denied",
      ad_user_data: consent.marketing ? "granted" : "denied",
      ad_personalization: consent.marketing ? "granted" : "denied",
    });
    if (tools.ga4) {
      addScript("es-ga4", `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tools.ga4)}`);
      w.gtag("js", new Date());
      w.gtag("config", tools.ga4, { anonymize_ip: true });
    }
    if (tools.gtm) {
      w.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
      addScript("es-gtm", `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(tools.gtm)}`);
    }
  }
  if (consent.marketing && tools.rdStation && /^[0-9a-f-]{36}$/.test(tools.rdStation)) {
    addScript("es-rdstation", `https://d335luupugsy2.cloudfront.net/js/loader-scripts/${tools.rdStation}-loader.js`);
  }
  if (consent.marketing && tools.metaPixel) {
    const id = tools.metaPixel.replace(/\D/g, "");
    addScript(
      "es-meta-pixel",
      null,
      `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`,
    );
    // Conversions that happened before the Pixel loaded (queued by SiteAnalytics), then any later ones.
    const m = window as unknown as { fbq?: (...args: unknown[]) => void; esMetaQueue?: unknown[][]; esFlushMeta?: () => void };
    m.esFlushMeta = () => {
      while (m.fbq && m.esMetaQueue?.length) m.fbq(...m.esMetaQueue.shift()!);
    };
    m.esFlushMeta();
  }
}

const TEXT = {
  "pt-BR": {
    dialog: "Aviso de cookies e privacidade", title: "Sua privacidade",
    withTools: "Usamos cookies essenciais para o site funcionar e, com a sua permissão, cookies de análise e de marketing para entender o uso do site e melhorar nossa comunicação. Saiba mais na",
    noTools: "Este site usa apenas cookies essenciais ao funcionamento, sem rastreamento de terceiros. Saiba como tratamos seus dados na",
    policy: "Política de Privacidade", prefs: "Preferências de cookies",
    essential: "Essenciais", essentialText: "Necessários para o site funcionar. Sempre ativos.",
    analytics: "Análise", analyticsText: "Medem as visitas e o uso do site (Google Analytics / Tag Manager).",
    marketing: "Marketing", marketingText: "Permitem anúncios mais relevantes e o acompanhamento de contatos (Meta Pixel, RD Station).",
    save: "Salvar preferências", accept: "Aceitar todos", reject: "Recusar", choose: "Preferências", ok: "Entendi",
  },
  en: {
    dialog: "Cookie and privacy notice", title: "Your privacy",
    withTools: "We use essential cookies to make the site work and, with your permission, analytics and marketing cookies to understand how the site is used and improve our communication. Learn more in our",
    noTools: "This site only uses cookies that are essential for it to work, with no third-party tracking. See how we handle your data in our",
    policy: "Privacy Policy", prefs: "Cookie preferences",
    essential: "Essential", essentialText: "Required for the site to work. Always on.",
    analytics: "Analytics", analyticsText: "Measure visits and site usage (Google Analytics / Tag Manager).",
    marketing: "Marketing", marketingText: "Allow more relevant ads and follow-up of contacts (Meta Pixel, RD Station).",
    save: "Save preferences", accept: "Accept all", reject: "Reject", choose: "Preferences", ok: "Got it",
  },
  es: {
    dialog: "Aviso de cookies y privacidad", title: "Su privacidad",
    withTools: "Usamos cookies esenciales para que el sitio funcione y, con su permiso, cookies de análisis y de marketing para entender el uso del sitio y mejorar nuestra comunicación. Más información en nuestra",
    noTools: "Este sitio usa solo cookies esenciales para su funcionamiento, sin rastreo de terceros. Vea cómo tratamos sus datos en nuestra",
    policy: "Política de Privacidad", prefs: "Preferencias de cookies",
    essential: "Esenciales", essentialText: "Necesarias para que el sitio funcione. Siempre activas.",
    analytics: "Análisis", analyticsText: "Miden las visitas y el uso del sitio (Google Analytics / Tag Manager).",
    marketing: "Marketing", marketingText: "Permiten anuncios más relevantes y el seguimiento de contactos (Meta Pixel, RD Station).",
    save: "Guardar preferencias", accept: "Aceptar todas", reject: "Rechazar", choose: "Preferencias", ok: "Entendido",
  },
  ja: {
    dialog: "Cookieとプライバシーに関するお知らせ", title: "プライバシーについて",
    withTools: "サイトの動作に必要なCookieに加え、お客様の同意がある場合は、サイトの利用状況を把握しコミュニケーションを改善するための分析用・マーケティング用Cookieを使用します。詳しくは次をご覧ください:",
    noTools: "このサイトでは、動作に必要なCookieのみを使用し、第三者による追跡は行いません。個人情報の取り扱いについては次をご覧ください:",
    policy: "プライバシーポリシー", prefs: "Cookieの設定",
    essential: "必須", essentialText: "サイトの動作に必要です。常に有効です。",
    analytics: "分析", analyticsText: "訪問数とサイトの利用状況を計測します(Google Analytics / Tag Manager)。",
    marketing: "マーケティング", marketingText: "より関連性の高い広告の表示と、お問い合わせのフォローアップに使います(Meta Pixel、RD Station)。",
    save: "設定を保存", accept: "すべて許可", reject: "拒否する", choose: "設定", ok: "OK",
  },
} as const;

export function CookieConsent({ integrations, policyHref = "/privacidade", locale = "pt-BR" }: { integrations: Integrations; policyHref?: string; locale?: keyof typeof TEXT }) {
  const t = TEXT[locale];
  const hasTools = Boolean(integrations.ga4 || integrations.gtm || integrations.metaPixel || integrations.rdStation);
  const hasAnalytics = Boolean(integrations.ga4 || integrations.gtm);
  const hasMarketing = Boolean(integrations.metaPixel || integrations.rdStation);
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const stored = readConsent();
    if (stored) {
      setAnalytics(stored.analytics);
      setMarketing(stored.marketing);
      loadTools(integrations, stored);
    } else {
      setOpen(true);
    }
    // Footer link "Preferências de cookies" reopens the panel.
    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest(OPEN_EVENT_SELECTOR);
      if (!target) return;
      e.preventDefault();
      setDetails(hasTools);
      setOpen(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [integrations, hasTools]);

  const decide = useCallback(
    (a: boolean, m: boolean) => {
      const previous = readConsent();
      const consent = saveConsent(a, m);
      // Revoking a category: tools already running can only be stopped by a fresh page.
      if ((previous?.analytics && !a) || (previous?.marketing && !m)) {
        window.location.reload();
        return;
      }
      setAnalytics(a);
      setMarketing(m);
      setOpen(false);
      setDetails(false);
      loadTools(integrations, consent);
    },
    [integrations],
  );

  if (!open) return null;

  const btn = "inline-flex min-h-10 items-center justify-center rounded-[var(--button-radius)] px-4 text-sm font-semibold transition";
  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t.dialog}
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-[var(--brand-radius)] border border-black/10 bg-white p-5 text-[#16181d] shadow-[0_24px_60px_-20px_rgb(0_0_0/0.45)] sm:inset-x-auto sm:left-5 sm:bottom-5"
    >
      <p className="text-base font-semibold">{t.title}</p>
      {hasTools ? (
        <p className="mt-2 text-sm leading-relaxed text-[#4a5060]">
          {t.withTools}{" "}
          <a href={policyHref} className="font-medium underline">
            {t.policy}
          </a>
          .
        </p>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-[#4a5060]">
          {t.noTools}{" "}
          <a href={policyHref} className="font-medium underline">
            {t.policy}
          </a>
          .
        </p>
      )}

      {hasTools && details && (
        <fieldset className="mt-4 space-y-3 rounded-[calc(var(--brand-radius)/1.5)] bg-[#f4f5f7] p-4 text-sm">
          <legend className="sr-only">{t.prefs}</legend>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked disabled className="mt-0.5 size-4" />
            <span>
              <span className="font-semibold">{t.essential}</span>
              <span className="block text-[#5b6270]">Necessários para o site funcionar. Sempre ativos.</span>
            </span>
          </label>
          {hasAnalytics && (
            <label className="flex items-start gap-3">
              <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} className="mt-0.5 size-4 accent-brand" />
              <span>
                <span className="font-semibold">{t.analytics}</span>
                <span className="block text-[#5b6270]">Medem visitas e uso do site (Google Analytics / Tag Manager).</span>
              </span>
            </label>
          )}
          {hasMarketing && (
            <label className="flex items-start gap-3">
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 size-4 accent-brand" />
              <span>
                <span className="font-semibold">{t.marketing}</span>
                <span className="block text-[#5b6270]">{t.marketingText}</span>
              </span>
            </label>
          )}
        </fieldset>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {hasTools ? (
          details ? (
            <button type="button" className={`${btn} bg-brand text-brand-contrast hover:brightness-110`} onClick={() => decide(analytics, marketing)}>
              {t.save}
            </button>
          ) : (
            <>
              <button type="button" className={`${btn} bg-brand text-brand-contrast hover:brightness-110`} onClick={() => decide(true, true)}>
                {t.accept}
              </button>
              <button type="button" className={`${btn} border border-black/15 hover:bg-black/5`} onClick={() => decide(false, false)}>
                {t.reject}
              </button>
              <button type="button" className={`${btn} text-[#4a5060] underline-offset-2 hover:underline`} onClick={() => setDetails(true)}>
                {t.choose}
              </button>
            </>
          )
        ) : (
          <button type="button" className={`${btn} bg-brand text-brand-contrast hover:brightness-110`} onClick={() => decide(false, false)}>
            {t.ok}
          </button>
        )}
      </div>
    </div>
  );
}
