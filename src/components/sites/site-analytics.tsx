"use client";

import { useEffect } from "react";
import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";
import { attributionForForm, captureAttribution } from "./attribution";

/*
 * Everest Sites' own analytics: page views, conversion clicks and loading
 * speed measured in real visitors' browsers (Core Web Vitals). No cookies and
 * nothing stored in the browser, so no consent banner is needed for it.
 * (Ad click attribution for the forms has its own rules: see ./attribution.)
 */

type Label = "whatsapp" | "phone" | "email" | "cta" | "outbound" | "form";

function send(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);
  try {
    if (!navigator.sendBeacon?.("/api/e", new Blob([body], { type: "text/plain" }))) {
      void fetch("/api/e", { method: "POST", body, keepalive: true });
    }
  } catch {
    // Analytics never breaks the page.
  }
}

/**
 * Events for the site's tag manager (GTM / Google Ads / GA4). Pushed even
 * before consent: the queue is only read once the visitor accepts and the
 * tags load, so nothing reaches Google without consent.
 */
function pushEvent(event: Record<string, unknown>) {
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push(event);
}

const CLICK_EVENTS: Partial<Record<Label, string>> = { whatsapp: "whatsapp_click", phone: "phone_click", email: "email_click" };

/*
 * WhatsApp with contact capture (business.whatsapp.leadCapture): the first WhatsApp click opens the short form
 * (<dialog data-wa-capture>), the contact goes to /api/lead as a "whatsapp" lead, then the chat opens with the
 * visitor's name in the message. A visitor who already left a contact goes straight to WhatsApp. Only a flag is
 * kept in the browser, never the contact itself.
 */
const WA_KNOWN_KEY = "es-wa-lead";
const WA_KNOWN_MS = 30 * 86_400_000;

function waKnown(): boolean {
  try {
    return Number(localStorage.getItem(WA_KNOWN_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

function rememberWa() {
  try {
    localStorage.setItem(WA_KNOWN_KEY, String(Date.now() + WA_KNOWN_MS));
  } catch {
    // Private mode: the form shows again next time.
  }
}

/** The chat link with "Meu nome é …" added to its message. */
function withName(href: string, intro: string, name: string, message = ""): string {
  try {
    const url = new URL(href);
    const text = url.searchParams.get("text")?.trim();
    const own = message.trim();
    // encodeURIComponent, not searchParams.set: WhatsApp shows a "+" for each space.
    return `${url.origin}${url.pathname}?text=${encodeURIComponent(`${text ? `${text}\n\n` : ""}${intro} ${name}.${own ? `\n\n${own}` : ""}`)}`;
  } catch {
    return href;
  }
}

/**
 * The same conversions as standard Meta Pixel events (Lead, Contact). Queued
 * and sent only when the Pixel is on the page, i.e. after marketing consent;
 * the consent banner flushes the queue when it loads the Pixel.
 */
function metaEvent(name: "Lead" | "Contact", params: Record<string, string>, eventID?: string) {
  const w = window as unknown as { esMetaQueue?: unknown[][]; esFlushMeta?: () => void };
  (w.esMetaQueue = w.esMetaQueue ?? []).push(["track", name, params, ...(eventID ? [{ eventID }] : [])]);
  w.esFlushMeta?.();
}

function classify(link: HTMLAnchorElement): Label | null {
  const href = link.getAttribute("href") ?? "";
  if (/wa\.me|whatsapp\.com/i.test(href)) return "whatsapp";
  if (href.startsWith("tel:")) return "phone";
  if (href.startsWith("mailto:")) return "email";
  if (link.hasAttribute("data-cta")) return "cta";
  try {
    const url = new URL(href, location.href);
    if (/^https?:$/.test(url.protocol) && url.hostname !== location.hostname) return "outbound";
  } catch {
    // Not a URL: ignore.
  }
  return null;
}

export function SiteAnalytics() {
  useEffect(() => {
    const path = location.pathname;
    const q = new URLSearchParams(location.search);
    captureAttribution();
    send({ k: "view", p: path, r: document.referrer || null, us: q.get("utm_source"), um: q.get("utm_medium"), uc: q.get("utm_campaign") });

    // Form result after the post (?enviado / ?obrigado / ?erro): the cached page carries both the form and its
    // messages, and only the box of the form that was sent changes.
    const sent = q.get("enviado") === "1" || q.get("obrigado") === "1";
    const failed = q.get("erro") === "1";
    if (sent || failed) {
      const section = q.get("secao");
      for (const box of document.querySelectorAll<HTMLElement>("[data-lead-box]")) {
        if (section && box.dataset.leadBox !== section) continue;
        if (sent) {
          box.querySelector<HTMLElement>("[data-lead-sent]")?.removeAttribute("hidden");
          box.querySelector("form")?.setAttribute("hidden", "");
        } else {
          box.querySelector<HTMLElement>("[data-lead-error]")?.removeAttribute("hidden");
        }
      }
    }

    // A lead was just sent: "generate_lead" for Google Ads / GA4, once per lead even if the page is reloaded.
    const leadId = q.get("obrigado") === "1" ? (q.get("t") ?? "") : null;
    if (leadId !== null) {
      let seen = false;
      try {
        seen = sessionStorage.getItem(`es-lead-${leadId}`) === "1";
        sessionStorage.setItem(`es-lead-${leadId}`, "1");
      } catch {
        // Private mode: count it.
      }
      if (!seen) {
        const type = q.get("tipo") ?? "contato";
        pushEvent({ event: "generate_lead", lead_type: type, form_section: q.get("secao") ?? "", page_path: path });
        metaEvent("Lead", { content_name: type }, leadId ? `lead-${leadId}` : undefined);
      }
    }

    const capture = document.querySelector<HTMLDialogElement>("dialog[data-wa-capture]");
    const captureForm = capture?.querySelector("form");
    let pendingChat = "";

    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement | null)?.closest("a");
      const label = link ? classify(link) : null;
      // First WhatsApp click: ask for the contact before opening the chat (counted when the chat opens).
      if (label === "whatsapp" && link && capture && typeof capture.showModal === "function" && !waKnown()) {
        e.preventDefault();
        pendingChat = link.href;
        capture.showModal();
        return;
      }
      if (label) send({ k: "click", p: path, l: label });
      const event = label ? CLICK_EVENTS[label] : undefined;
      if (event && link) {
        pushEvent({ event, link_url: link.href, page_path: path });
        metaEvent("Contact", { content_name: label! });
      }
    };
    const openedAt = Date.now();
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      if (!form?.action.includes("/api/lead")) return;
      // When the page opened: the spam filter flags forms sent in under 3 seconds or by scripts without a browser.
      const ts = form.querySelector<HTMLInputElement>('input[name="ts"]');
      if (ts) ts.value = String(openedAt);
      // The ad click that brought the visitor, so a sale can be reported back to Google Ads and Meta.
      const attr = form.querySelector<HTMLInputElement>('input[name="attr"]');
      const attribution = attributionForForm();
      if (attr && attribution) attr.value = JSON.stringify(attribution);
      // The WhatsApp form counts as a WhatsApp click (onCaptureSubmit), not as a form.
      if (!form.closest("dialog[data-wa-capture]")) send({ k: "click", p: path, l: "form" });
    };
    const onCaptureSubmit = (e: SubmitEvent) => {
      if (!capture || !captureForm) return;
      e.preventDefault();
      // ts and attr were filled by onSubmit (capture phase, runs first).
      const data = new FormData(captureForm);
      data.set("page", path);
      const name = String(data.get("name") ?? "").trim();
      let queued = false;
      try {
        queued = navigator.sendBeacon?.("/api/lead", data) ?? false;
      } catch {
        queued = false;
      }
      if (!queued) void fetch("/api/lead", { method: "POST", body: data, keepalive: true, redirect: "manual" }).catch(() => undefined);
      rememberWa();
      const chat = withName(pendingChat, captureForm.dataset.waIntro ?? "", name, String(data.get("message") ?? ""));
      // Still inside the visitor's click, so the new tab is not blocked.
      window.open(chat, "_blank", "noopener");
      capture.close();
      captureForm.reset();
      const leadId = Date.now().toString(36);
      pushEvent({ event: "generate_lead", lead_type: "whatsapp", form_section: "whatsapp", page_path: path });
      pushEvent({ event: "whatsapp_click", link_url: chat, page_path: path });
      metaEvent("Lead", { content_name: "whatsapp" }, `lead-${leadId}`);
      send({ k: "click", p: path, l: "whatsapp" });
    };
    const onCaptureClose = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // The × button, or a click on the backdrop (the dialog itself, outside the form).
      if (target.closest("[data-wa-close]") || target === capture) capture?.close();
    };
    captureForm?.addEventListener("submit", onCaptureSubmit);
    capture?.addEventListener("click", onCaptureClose);

    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("submit", onSubmit, { capture: true });

    /*
     * Vitals, in two reports: loading (TTFB, FCP, LCP) a few seconds after the
     * page settles, so a visitor who leaves abruptly is still measured; and
     * interaction (INP, CLS) when the visitor leaves or hides the tab.
     */
    const loading: Record<string, number> = {};
    const interaction: Record<string, number> = {};
    const keep = (bag: Record<string, number>, name: string) => (m: { value: number }) => {
      bag[name] = name === "cls" ? Math.round(m.value * 1000) / 1000 : Math.round(m.value);
    };
    onTTFB(keep(loading, "ttfb"));
    onFCP(keep(loading, "fcp"));
    // reportAllChanges: the largest paint so far, without waiting for an input or for the tab to hide.
    onLCP(keep(loading, "lcp"), { reportAllChanges: true });
    onINP(keep(interaction, "inp"));
    onCLS(keep(interaction, "cls"), { reportAllChanges: true });

    let loadingSent = false;
    const sendLoading = () => {
      if (loadingSent || Object.keys(loading).length === 0) return;
      loadingSent = true;
      send({ k: "vitals", p: path, v: loading });
    };
    const timer = window.setTimeout(sendLoading, 6000);

    let interactionSent = false;
    const leave = () => {
      sendLoading();
      if (interactionSent || Object.keys(interaction).length === 0) return;
      interactionSent = true;
      send({ k: "vitals", p: path, v: interaction });
    };
    const onHidden = () => document.visibilityState === "hidden" && leave();
    document.addEventListener("visibilitychange", onHidden);
    // Some browsers navigate away without hiding the tab first.
    window.addEventListener("pagehide", leave);

    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("submit", onSubmit, { capture: true });
      captureForm?.removeEventListener("submit", onCaptureSubmit);
      capture?.removeEventListener("click", onCaptureClose);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", leave);
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}
