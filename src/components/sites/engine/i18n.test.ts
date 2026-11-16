import { describe, expect, it } from "vitest";
import { localHref, ui } from "./i18n";

describe("localHref", () => {
  it("keeps Portuguese links as they are", () => {
    expect(localHref({}, "/taurus")).toBe("/taurus");
    expect(localHref({ locale: "pt-BR" }, "/")).toBe("/");
  });

  it("prefixes internal pages and anchors with the language", () => {
    expect(localHref({ locale: "en" }, "/taurus")).toBe("/en/taurus");
    expect(localHref({ locale: "en" }, "/")).toBe("/en");
    expect(localHref({ locale: "es" }, "/#contato")).toBe("/es#contato");
    expect(localHref({ locale: "es" }, "/rebobinadeiras#compac")).toBe("/es/rebobinadeiras#compac");
  });

  it("never touches external links, same-page anchors, files or already prefixed links", () => {
    expect(localHref({ locale: "en" }, "https://wa.me/55")).toBe("https://wa.me/55");
    expect(localHref({ locale: "en" }, "#contato")).toBe("#contato");
    expect(localHref({ locale: "en" }, "/demo/x.webp")).toBe("/demo/x.webp");
    expect(localHref({ locale: "en" }, "/en/taurus")).toBe("/en/taurus");
    expect(localHref({ locale: "en" }, "//cdn.example.com/a")).toBe("//cdn.example.com/a");
  });

  it("speaks the visitor's language", () => {
    expect(ui({ locale: "en" }).send).toBe("Send message");
    expect(ui({ locale: "es" }).send).toBe("Enviar mensaje");
    expect(ui({}).send).toBe("Enviar mensagem");
  });
});
