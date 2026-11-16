import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { CURRENT_SCHEMA_VERSION, parseSiteContent } from "./site";

const ASSET = "6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f";

function jomalai() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    theme: { colors: { primary: "#1F6B3A" } },
    business: {
      name: "Jomalai Serviços Ambientais",
      phone: "(11) 4521-0000",
      whatsapp: { number: "55 11 98765-4321", defaultMessage: "Olá! Quero um orçamento de caçamba." },
      address: { city: "Jundiaí", state: "SP", postalCode: "13212-448" },
      socials: { instagram: "https://instagram.com/jomalai" },
    },
    integrations: { ga4: "G-ABC1234" },
    seo: { title: "Jomalai", description: "Locação de caçambas e destinação de resíduos da construção civil." },
    pages: [
      {
        slug: "",
        title: "Início",
        sections: [
          {
            id: "inicio",
            type: "hero",
            variant: "split",
            heading: "Caçambas para entulho com destinação correta",
            primaryCta: { label: "Pedir orçamento", action: { type: "whatsapp" } },
            image: { assetId: ASSET, alt: "Caçamba Jomalai em obra" },
          },
          {
            id: "servicos",
            type: "services",
            variant: "cards",
            items: [{ title: "Locação de caçambas" }, { title: "Reciclagem de RCD", href: "/redivivus" }],
          },
          { id: "contato", type: "contact", variant: "form-and-info" },
        ],
      },
      { slug: "redivivus", title: "Redivivus", sections: [] },
    ],
  };
}

function issues(input: unknown): string[] {
  try {
    parseSiteContent(input);
    return [];
  } catch (error) {
    if (error instanceof ZodError) return error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw error;
  }
}

describe("parseSiteContent", () => {
  it("accepts a realistic site and fills defaults", () => {
    const site = parseSiteContent(jomalai());

    expect(site.theme).toMatchObject({ colors: { primary: "#1f6b3a" }, fontPair: "inter", radius: "md", mode: "light" });
    expect(site.business.whatsapp?.number).toBe("5511987654321");
    expect(site.business.phone).toBe("551145210000");
    expect(site.business.complianceMode).toBe("none");
    const contact = site.pages[0]!.sections[2];
    expect(contact).toMatchObject({ type: "contact", hidden: false, fields: { phone: true, company: false } });
  });

  it.each([
    ["javascript:alert(1)"],
    ["JaVaScRiPt:alert(1)"],
    ["data:text/html,<script>alert(1)</script>"],
    ["//evil.com"],
    ["vbscript:msgbox"],
  ])("rejects unsafe link %s", (bad) => {
    const doc = jomalai();
    doc.pages[0]!.sections[1] = { ...doc.pages[0]!.sections[1]!, items: [{ title: "x", href: bad }] } as never;
    expect(issues(doc).some((i) => i.includes("Link inválido"))).toBe(true);
  });

  it("rejects analytics IDs that could inject script", () => {
    const doc = jomalai();
    doc.integrations = { ga4: "G-123');alert(1);//" };
    expect(issues(doc)).toContainEqual(expect.stringContaining("integrations.ga4"));
  });

  it("requires a home page and unique page slugs and section ids", () => {
    const doc = jomalai();
    doc.pages[0]!.slug = "redivivus";
    doc.pages[0]!.sections[1]!.id = "inicio";
    const found = issues(doc);
    expect(found).toContainEqual(expect.stringContaining("Página duplicada"));
    expect(found).toContainEqual(expect.stringContaining("Seção duplicada"));
    expect(found).toContainEqual(expect.stringContaining("página inicial"));
  });

  it("rejects malformed colors, phones and states", () => {
    const doc = jomalai();
    doc.theme.colors.primary = "green";
    doc.business.whatsapp!.number = "98765-4321";
    doc.business.address!.state = "São Paulo";
    const found = issues(doc);
    expect(found).toContainEqual(expect.stringContaining("theme.colors.primary"));
    expect(found).toContainEqual(expect.stringContaining("business.whatsapp.number"));
    expect(found).toContainEqual(expect.stringContaining("business.address.state"));
  });

  it("rejects unknown section types and variants", () => {
    const doc = jomalai();
    doc.pages[0]!.sections.push({ id: "x", type: "carrossel-3d", variant: "a" } as never);
    doc.pages[0]!.sections[0] = { ...doc.pages[0]!.sections[0]!, variant: "spinning" } as never;
    expect(issues(doc).length).toBeGreaterThanOrEqual(2);
  });

  it("caps text lengths so a paste accident cannot bloat a page", () => {
    const doc = jomalai();
    (doc.pages[0]!.sections[0] as { heading: string }).heading = "a".repeat(500);
    expect(issues(doc)).toContainEqual(expect.stringContaining("pages.0.sections.0.heading"));
  });
});

describe("new sections", () => {
  it("accepts credentials, steps and team, and validates team links", () => {
    const doc = jomalai();
    doc.pages[1]!.sections = [
      { id: "credenciais", type: "credentials", variant: "list", items: [{ title: "OAB/SP 482.249" }] },
      { id: "metodo", type: "steps", variant: "timeline", items: [{ title: "Antecipar" }, { title: "Viabilizar" }] },
      {
        id: "equipe",
        type: "team",
        variant: "featured",
        members: [{ name: "Matheus Bottoli", registration: "OAB/SP 482.249", linkedin: "https://linkedin.com/in/x" }],
      },
    ] as never;
    expect(issues(doc)).toEqual([]);

    (doc.pages[1]!.sections[2] as unknown as { members: { linkedin: string }[] }).members[0]!.linkedin = "javascript:alert(1)";
    expect(issues(doc).some((i) => i.includes("Link inválido"))).toBe(true);
  });

  it("requires at least two steps", () => {
    const doc = jomalai();
    doc.pages[1]!.sections = [{ id: "metodo", type: "steps", variant: "cards", items: [{ title: "Só um" }] }] as never;
    expect(issues(doc).length).toBeGreaterThan(0);
  });
});
