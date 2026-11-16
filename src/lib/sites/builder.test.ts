import { describe, expect, it } from "vitest";
import { getPack } from "@/packs/registry";
import { applyBriefingToDocument, BriefingError, buildSiteContent, buildSiteDocument, subdomainLabel } from "./builder";
import { parseSiteContent } from "./content";

const briefing = {
  name: "Escritório Exemplo",
  city: "Jundiaí",
  state: "sp",
  whatsapp: "(11) 98765-4321",
  responsibleName: "Maria Souza",
  registration: "CRC 1SP123456/O-0",
};

describe("buildSiteContent", () => {
  for (const key of ["geral", "contabilidade"]) {
    it(`gera um site válido a partir do pacote ${key}`, () => {
      const pack = getPack(key)!;
      const content = buildSiteContent(pack, briefing);
      // O que sai do gerador sempre passa pelo mesmo validador que protege o site publicado.
      expect(() => parseSiteContent(JSON.parse(JSON.stringify(content)))).not.toThrow();
      expect(content.pages.some((p) => p.slug === "")).toBe(true);
      expect(content.business.name).toBe("Escritório Exemplo");
      expect(content.business.whatsapp?.number).toBe("5511987654321");
      expect(content.business.address).toMatchObject({ city: "Jundiaí", state: "SP" });
      // Nenhuma variável ficou sem preencher.
      expect(JSON.stringify(content)).not.toMatch(/\{\{/);
    });
  }

  it("páginas de captação ficam fora do menu e com cabeçalho enxuto", () => {
    const content = buildSiteContent(getPack("contabilidade")!, briefing);
    const landings = content.pages.filter((p) => p.landing);
    expect(landings.map((p) => p.slug).sort()).toEqual(["abertura-de-empresa", "imposto-de-renda", "troca-de-contador"]);
    for (const l of landings) {
      expect(l.showInMenu).toBe(false);
      expect(l.sections.some((s) => s.type === "contact")).toBe(true);
    }
  });

  it("nicho regulado exige responsável e registro, e os coloca no rodapé", () => {
    const pack = getPack("contabilidade")!;
    expect(() => buildSiteContent(pack, { ...briefing, registration: undefined })).toThrow(BriefingError);
    expect(() => buildSiteContent(pack, { ...briefing, responsibleName: "" })).toThrow(BriefingError);
    const notice = buildSiteContent(pack, briefing).business.footerNotice ?? "";
    expect(notice).toContain("Maria Souza");
    expect(notice).toContain("CRC 1SP123456/O-0");
  });

  it("o pacote geral não exige registro nem tem aviso de rodapé", () => {
    const content = buildSiteContent(getPack("geral")!, { ...briefing, responsibleName: undefined, registration: undefined });
    expect(content.business.footerNotice).toBeUndefined();
  });

  it("rejeita briefing incompleto com mensagens em português", () => {
    try {
      buildSiteContent(getPack("geral")!, { name: "", city: "", state: "S", whatsapp: "" });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(BriefingError);
      expect((e as BriefingError).issues.map((i) => i.path)).toEqual(expect.arrayContaining(["name", "city", "state", "whatsapp"]));
    }
  });

  it("serviços informados substituem os do modelo nas páginas do site, mas não nas de captação", () => {
    const pack = getPack("contabilidade")!;
    const content = buildSiteContent(pack, { ...briefing, services: [{ title: "Serviço próprio" }] });
    const home = content.pages.find((p) => p.slug === "")!;
    const services = home.sections.find((s) => s.type === "services");
    expect(services && services.type === "services" && services.items.map((i) => i.title)).toEqual(["Serviço próprio"]);
  });

  it("aceita Instagram como @usuario e a cor do cliente", () => {
    const content = buildSiteContent(getPack("geral")!, { ...briefing, instagram: "@exemplo", primaryColor: "#FF8800" });
    expect(content.business.socials.instagram).toBe("https://instagram.com/exemplo");
    expect(content.theme.colors.primary).toBe("#ff8800");
  });

  it("nomes muito longos não estouram os limites do esquema", () => {
    const longName = "Escritório " + "de Serviços Especializados ".repeat(3);
    expect(() => buildSiteContent(getPack("contabilidade")!, { ...briefing, name: longName.slice(0, 100) })).not.toThrow();
  });
});

describe("applyBriefingToDocument", () => {
  it("atualiza contatos e cor sem refazer as páginas editadas", () => {
    const pack = getPack("geral")!;
    const doc = buildSiteDocument(pack, briefing);
    doc.content.pages[0].sections[0] = { ...doc.content.pages[0].sections[0], heading: "Título que a pessoa ajustou", highlight: undefined } as never;
    const next = applyBriefingToDocument(pack, doc, { ...briefing, phone: "(11) 4000-1234", primaryColor: "#112233" });
    expect(next.content.business.phone).toBe("5511" + "40001234");
    expect(next.content.theme.colors.primary).toBe("#112233");
    expect((next.content.pages[0].sections[0] as { heading?: string }).heading).toBe("Título que a pessoa ajustou");
  });
});

describe("subdomainLabel", () => {
  it("tira acentos, espaços e símbolos", () => {
    expect(subdomainLabel("Padaria do Sol & Cia.")).toBe("padaria-do-sol-cia");
    expect(subdomainLabel("Escritório Contábil São João")).toBe("escritorio-contabil-sao-joao");
  });
  it("nome curto demais ganha prefixo", () => {
    expect(subdomainLabel("A")).toBe("site-a");
  });
});
