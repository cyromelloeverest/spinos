import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";

// Fumaça das telas: executa as consultas reais de cada página contra o schema real
// (Postgres em memória, RLS ligada, papel restrito), com dados nos vários estados.
// Não renderiza HTML: chama a página e confere que ela monta sem lançar erro.
const h = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY ??= "sk_test_smoke_dummy"; // só para o módulo importar; nada é cobrado
  return { prisma: null as unknown };
});
vi.mock("@/lib/prisma", () => ({ get prisma() { return h.prisma; } }));
vi.mock("@/lib/auth/current-org", () => ({
  getCurrentOrganizationId: async () => "org-A",
  getCurrentUserId: async () => "user-1",
  getCurrentMembership: async () => ({ organizationId: "org-A", userId: "user-1", role: "OWNER" }),
  isCurrentUserSuperAdmin: async () => false,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); },
  notFound: () => { throw new Error("NOT_FOUND"); },
}));

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createPrismaOnPglite, enterAppRole } from "@/lib/db/pglite-harness";
import type { PrismaClient } from "@/generated/prisma/client";

let db: PGlite;
let prisma: PrismaClient;
const ids: { fresh?: string; inPipeline?: string; won?: string; lost?: string; dismissed?: string } = {};

async function score(name: string, status: "NEW" | "DISMISSED" = "NEW") {
  const company = await prisma.company.create({ data: { name, cnpj: `${Math.random().toString().slice(2, 16)}`.padEnd(14, "0"), city: "Jundiaí", state: "SP" } });
  const icp = await prisma.iCP.findFirstOrThrow({ where: { organizationId: "org-A" } });
  return prisma.opportunityScore.create({
    data: { organizationId: "org-A", companyId: company.id, icpId: icp.id, score: 90, urgency: "ALTA", headline: name, execSummary: "x", reasoning: "x", suggestedApproach: "x", commercialArguments: ["a"], objections: ["o"], status, decisionMakerName: "Decisor Teste", decisionMaker: "Diretor" },
  });
}

beforeAll(async () => {
  const r = await createPrismaOnPglite();
  db = r.db;
  prisma = r.prisma;
  h.prisma = prisma;
  await prisma.user.create({ data: { id: "user-1", email: "u@x.com", name: "Usuária" } });
  await prisma.organization.create({ data: { id: "org-A", name: "Org A", plan: "PROFISSIONAL" } });
  await prisma.membership.create({ data: { userId: "user-1", organizationId: "org-A", role: "OWNER" } });
  await prisma.iCP.create({ data: { organizationId: "org-A" } });
  ids.fresh = (await score("Empresa Nova")).id;
  ids.dismissed = (await score("Empresa Descartada", "DISMISSED")).id;
  ids.inPipeline = (await score("Empresa No Funil")).id;
  ids.won = (await score("Empresa Vendida")).id;
  ids.lost = (await score("Empresa Perdida")).id;
  await prisma.mission.create({ data: { organizationId: "org-A" } });
  await enterAppRole(db);
  // Estados do funil pelas próprias ações do app (também prova que elas rodam aqui).
  const { setStage, moveToPipeline, dismissOpportunity } = await import("@/lib/actions/pipeline");
  await moveToPipeline(ids.inPipeline!).catch(() => {}); // redirect() do mock lança
  await setStage(ids.won!, "VENDIDO");
  await setStage(ids.lost!, "PERDIDO", "WRONG_FIT", "fora do perfil");
  await dismissOpportunity(ids.dismissed!).catch(() => {});
}, 90_000);

afterAll(async () => {
  await prisma.$disconnect();
  await db.close();
});

describe("as telas montam com dados reais em todos os estados", () => {
  it("dashboard", async () => {
    const Page = (await import("@/app/(app)/page")).default;
    const el = await Page({ searchParams: Promise.resolve({}) });
    expect(el).toBeTruthy();
  });
  it("pipeline: as 3 negociações e a coluna 'Oportunidades' (sem as descartadas)", async () => {
    const Page = (await import("@/app/(app)/pipeline/page")).default;
    const el = (await Page({ searchParams: Promise.resolve({ owner: "all" }) })) as { props: { children: Array<{ props?: { initialCards?: { id: string; stage: string }[]; stages?: unknown[] } }> } };
    const board = el.props.children.find((c) => c?.props?.initialCards);
    const cards = board!.props!.initialCards!;
    expect(cards.map((c) => c.id)).not.toContain(ids.dismissed);
    expect(cards.find((c) => c.id === ids.fresh)?.stage).toBe("NOVA");
    expect(cards.find((c) => c.id === ids.inPipeline)?.stage).toBe("CONTATO_FEITO");
    expect(cards.find((c) => c.id === ids.won)?.stage).toBe("VENDIDO");
    expect(cards.find((c) => c.id === ids.lost)?.stage).toBe("PERDIDO");
    expect(board!.props!.stages).toHaveLength(5);
  });
  it("pipeline com a gaveta aberta e o filtro 'Minhas' monta, e a gaveta renderiza em HTML", async () => {
    const Page = (await import("@/app/(app)/pipeline/page")).default;
    const el = (await Page({ searchParams: Promise.resolve({ owner: "me", abrir: ids.inPipeline!, erro: "Algo deu errado" }) })) as { props: { children: Array<{ props?: { data?: unknown } } | false | null> } };
    const drawerEl = el.props.children.find((c) => c && typeof c === "object" && c.props?.data) as { type: unknown; props: Record<string, unknown> };
    expect(drawerEl).toBeTruthy();
    const html = renderToStaticMarkup(createElement(drawerEl.type as never, drawerEl.props as never));
    expect(html).toContain("Empresa No Funil");
    expect(html).toContain("Próximos passos");
    expect(html).toContain("Algo deu errado");
    expect(html).toContain("Agendar");
    const fresh = (await Page({ searchParams: Promise.resolve({ owner: "me", abrir: ids.fresh! }) })) as { props: { children: Array<{ props?: { data?: unknown } } | false | null> } };
    const freshDrawer = fresh.props.children.find((c) => c && typeof c === "object" && c.props?.data) as { type: unknown; props: Record<string, unknown> };
    expect(renderToStaticMarkup(createElement(freshDrawer.type as never, freshDrawer.props as never))).toContain("Mover para o pipeline");
  });
  it("atividades, em cada aba", async () => {
    const Page = (await import("@/app/(app)/atividades/page")).default;
    for (const aba of ["atrasadas", "hoje", "proximas", "concluidas"]) {
      expect(await Page({ searchParams: Promise.resolve({ aba, owner: "all" }) })).toBeTruthy();
    }
  });
  it("oportunidades", async () => {
    const Page = (await import("@/app/(app)/oportunidades/page")).default;
    expect(await Page({ searchParams: Promise.resolve({}) } as never)).toBeTruthy();
  });
  it("histórico", async () => {
    const Page = (await import("@/app/(app)/historico/page")).default;
    expect(await Page()).toBeTruthy();
  });
  it("assistente de vendas", async () => {
    const Page = (await import("@/app/(app)/assistente-vendas/page")).default;
    expect(await Page({ searchParams: Promise.resolve({}) })).toBeTruthy();
  });
  it("ficha da empresa (com e sem negociação)", async () => {
    const Page = (await import("@/app/(app)/company/[id]/page")).default;
    expect(await Page({ params: Promise.resolve({ id: ids.fresh! }) })).toBeTruthy();
    expect(await Page({ params: Promise.resolve({ id: ids.inPipeline! }) })).toBeTruthy();
  });
  it("exportação CSV traz a etapa de cada oportunidade", async () => {
    const { GET } = await import("@/app/(app)/export/route");
    const res = await GET();
    const text = await res.text();
    if (res.status === 200) {
      expect(text).toContain("CONTATO_FEITO");
      expect(text).toContain("VENDIDO");
      expect(text).toContain("Não iniciado");
    } else {
      expect(res.status).toBe(403);
    }
  });
  it("exportação dos dados da conta (LGPD) inclui os contatos", async () => {
    const { GET } = await import("@/app/api/account/export/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = JSON.parse(await res.text());
    expect(body.oportunidades.length).toBe(5);
    expect(body.oportunidades[0]).toHaveProperty("contatos");
  });
});
