import { describe, expect, it } from "vitest";
import { parseSiteContent, section } from "@/lib/sites/content";
import { ctaHref, whatsappUrl, type RenderContext } from "./context";
import { isRenderable } from "./render";
import { readableOn, themeVariables } from "./theme";

function ctx(overrides: Record<string, unknown> = {}): RenderContext {
  const site = parseSiteContent({
    schemaVersion: 1,
    theme: { colors: { primary: "#0b3d91" } },
    business: { name: "Bottoli Advocacia", whatsapp: { number: "11987654321", defaultMessage: "Olá, gostaria de agendar." }, ...overrides },
    seo: { title: "Bottoli" },
    pages: [{ slug: "", title: "Início", sections: [] }],
  });
  return { site, media: {}, pagePath: "/" };
}

describe("theme", () => {
  it("picks readable text colors for any brand color", () => {
    expect(readableOn("#0b3d91")).toBe("#ffffff");
    expect(readableOn("#ffd400")).toBe("#111111");
  });

  it("maps pill buttons to fully rounded corners", () => {
    const vars = themeVariables({ ...ctx().site.theme, buttonStyle: "pill" });
    expect(vars["--button-radius"]).toBe("999px");
  });
});

describe("links", () => {
  it("encodes the WhatsApp message", () => {
    expect(whatsappUrl("5511987654321", "Olá & tudo bem?")).toBe("https://wa.me/5511987654321?text=Ol%C3%A1%20%26%20tudo%20bem%3F");
  });

  it("falls back to the contact section when the site has no WhatsApp", () => {
    const noWhatsapp = ctx({ whatsapp: undefined });
    expect(ctaHref(noWhatsapp, { label: "Falar", action: { type: "whatsapp" } })).toBe("#contato");
  });
});

describe("OAB compliance mode", () => {
  const testimonials = section.parse({ id: "dep", type: "testimonials", variant: "cards", items: [{ quote: "Ótimo", author: "Ana" }] });
  const numbers = section.parse({ id: "num", type: "numbers", variant: "row", items: [{ value: "500+", label: "causas ganhas" }] });

  it("never renders testimonials or result numbers for law firms", () => {
    const law = ctx({ complianceMode: "oab" });
    expect(isRenderable(testimonials, law)).toBe(false);
    expect(isRenderable(numbers, law)).toBe(false);
  });

  it("renders them for everyone else", () => {
    expect(isRenderable(testimonials, ctx())).toBe(true);
  });
});

describe("single h1 per page", () => {
  it("promotes the first section title to h1 when the page has no hero", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { SectionList } = await import("./render");
    const about = section.parse({ id: "sobre", type: "about", variant: "text-only", heading: "Sobre", body: "Texto" });
    const faq = section.parse({ id: "faq", type: "faq", variant: "accordion", heading: "Dúvidas", items: [{ question: "P?", answer: "R" }] });
    const html = renderToStaticMarkup(<SectionList sections={[about, faq]} ctx={ctx()} />);
    expect(html.match(/<h1/g)?.length).toBe(1);
    expect(html).toContain("<h1");
    expect(html).toMatch(/<h1[^>]*>Sobre<\/h1>/);
  });

  it("keeps the hero as the only h1", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { SectionList } = await import("./render");
    const hero = section.parse({ id: "inicio", type: "hero", variant: "centered", heading: "Título" });
    const about = section.parse({ id: "sobre", type: "about", variant: "text-only", heading: "Sobre", body: "Texto" });
    const html = renderToStaticMarkup(<SectionList sections={[hero, about]} ctx={ctx()} />);
    expect(html.match(/<h1/g)?.length).toBe(1);
    expect(html).toMatch(/<h2[^>]*>Sobre<\/h2>/);
  });
});

import { parseVideo } from "./ui";
describe("video links", () => {
  it("keeps only ids and https mp4 files", () => {
    expect(parseVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5")).toEqual({ kind: "youtube", id: "dQw4w9WgXcQ" });
    expect(parseVideo("https://youtu.be/dQw4w9WgXcQ")).toEqual({ kind: "youtube", id: "dQw4w9WgXcQ" });
    expect(parseVideo("https://vimeo.com/123456789")).toEqual({ kind: "vimeo", id: "123456789" });
    expect(parseVideo("https://cdn.example.com/feira.mp4")).toEqual({ kind: "file", src: "https://cdn.example.com/feira.mp4" });
    expect(parseVideo("http://cdn.example.com/feira.mp4")).toBeNull();
    expect(parseVideo("/demo/tm/hero-video.mp4")).toEqual({ kind: "file", src: "/demo/tm/hero-video.mp4" });
    expect(parseVideo("//evil.example.com/x.mp4")).toBeNull();
    expect(parseVideo("/demo/../x.mp4")).toBeNull();
    expect(parseVideo("https://evil.example.com/x.mp4\" onerror=\"alert(1)")).toBeNull();
    expect(parseVideo("/contato")).toBeNull();
  });
});
