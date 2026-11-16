import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/proxy", () => ({ updateSession: async () => new Response("platform", { status: 200, headers: { "x-platform": "1" } }) }));

import { proxy } from "./proxy";

const req = (host: string, path = "/") => new NextRequest(`https://${host}${path}`, { headers: { host } });

describe("proxy: sites de clientes x plataforma", () => {
  it("domínio de cliente é reescrito para o renderizador, com o domínio como segmento", async () => {
    const res = await proxy(req("escritorio.com.br", "/servicos"));
    expect(res.headers.get("x-middleware-rewrite")).toContain("/sites/escritorio.com.br/servicos");
    const home = await proxy(req("escritorio.com.br", "/"));
    expect(home.headers.get("x-middleware-rewrite")).toMatch(/\/sites\/escritorio\.com\.br$/);
  });

  it("o endereço provisório também é um site", async () => {
    const res = await proxy(req("padaria.sites.spinos.com.br", "/contato"));
    expect(res.headers.get("x-middleware-rewrite")).toContain("/sites/padaria.sites.spinos.com.br/contato");
  });

  it("no domínio da plataforma o caminho interno /sites não existe (404), para site de cliente não abrir na origem do app", async () => {
    for (const path of ["/sites", "/sites/escritorio.com.br", "/sites/escritorio.com.br/api/lead"]) {
      const res = await proxy(req("app.spinos.com.br", path));
      expect(res.status).toBe(404);
    }
  });

  it("host com caracteres estranhos não vira caminho interno", async () => {
    for (const host of ["a_b.com", "x.com/../../admin", "é.com.br"]) {
      const res = await proxy(req("ok.example", "/")).then(() => proxy(new NextRequest("https://ok.example/", { headers: { host } })));
      expect(res.status).toBe(404);
    }
  });

  it("rotas normais da plataforma seguem para a sessão", async () => {
    const res = await proxy(req("app.spinos.com.br", "/pipeline"));
    expect(res.headers.get("x-platform")).toBe("1");
  });

  it("www.app redireciona para o domínio canônico", async () => {
    const res = await proxy(req("www.app.spinos.com.br", "/login"));
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toContain("app.spinos.com.br/login");
  });
});
