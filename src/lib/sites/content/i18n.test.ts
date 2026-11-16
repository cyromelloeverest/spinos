import { describe, expect, it } from "vitest";
import { localizeContent, parseTranslations } from "./i18n";
import { CURRENT_SCHEMA_VERSION, parseSiteContent } from "./site";

const main = () =>
  parseSiteContent({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    theme: { colors: { primary: "#1F6B3A" } },
    business: { name: "Fábrica", tagline: "Máquinas brasileiras", whatsapp: { number: "5511999990000", defaultMessage: "Olá!" } },
    seo: { title: "Fábrica", description: "Máquinas" },
    languages: ["en"],
    pages: [
      { slug: "", title: "Início", sections: [{ id: "topo", type: "hero", variant: "centered", heading: "Máquinas feitas no Brasil", highlight: "no Brasil" }] },
      { slug: "sobre", title: "Sobre", sections: [{ id: "sobre", type: "about", variant: "text-only", heading: "Quem somos", body: "Texto" }] },
    ],
  });

const en = {
  business: { tagline: "Brazilian machines", whatsappMessage: "Hello!" },
  seo: { title: "Factory", description: "Machines" },
  pages: [{ slug: "", title: "Home", sections: [{ id: "topo", type: "hero", variant: "centered", heading: "Machines made in Brazil", highlight: "in Brazil" }] }],
};

describe("translations", () => {
  it("puts the translated texts on top of the main content and keeps the rest", () => {
    const site = main();
    const t = parseTranslations({ en }, site).en!;
    const out = localizeContent(site, t);
    expect(out.pages[0]!.title).toBe("Home");
    // A page without translation falls back to the main language instead of disappearing.
    expect(out.pages[1]!.title).toBe("Sobre");
    expect(out.business.tagline).toBe("Brazilian machines");
    expect(out.business.whatsapp?.defaultMessage).toBe("Hello!");
    expect(out.business.whatsapp?.number).toBe("5511999990000");
    expect(out.theme).toEqual(site.theme);
  });

  it("keeps the blog, and its page, in the main language only", () => {
    const site = parseSiteContent({
      ...main(),
      pages: [...main().pages, { slug: "noticias", title: "Notícias", sections: [{ id: "lista", type: "posts", variant: "cards", heading: "Notícias" }] }],
      blog: { slug: "noticias", title: "Notícias", categories: [{ slug: "geral", name: "Geral" }] },
    });
    const out = localizeContent(site, parseTranslations({ en }, site).en!);
    expect(out.blog).toBeUndefined();
    expect(out.pages.map((p) => p.slug)).toEqual(["", "sobre"]);
  });

  it("ignores languages the site does not offer", () => {
    expect(parseTranslations({ es: en }, main())).toEqual({});
  });

  it("rejects a translated page that does not exist in the main site", () => {
    expect(() => parseTranslations({ en: { ...en, pages: [{ ...en.pages[0], slug: "contato" }] } }, main())).toThrow(/não existe/);
  });

  it("validates the translated site like any site (highlight inside the heading)", () => {
    const site = main();
    const bad = parseTranslations({ en: { ...en, pages: [{ ...en.pages[0], sections: [{ ...en.pages[0]!.sections[0], highlight: "no Brasil" }] }] } }, site).en!;
    expect(() => localizeContent(site, bad)).toThrow();
  });
});
