import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEARCH_COOLDOWN_MS } from "./constants";
import { PLANS } from "@/lib/plans";

const {
  organizationFindUnique,
  organizationUpdate,
  icpFindFirst,
  opportunityScoreCount,
  opportunityScoreUpsert,
  searchRunCount,
  searchRunCreate,
  searchRunDelete,
  companyFindMany,
  companyCreate,
  signalCreate,
  opportunityScoreSignalCreate,
  parseMock,
} = vi.hoisted(() => ({
  organizationFindUnique: vi.fn(),
  organizationUpdate: vi.fn(),
  icpFindFirst: vi.fn(),
  opportunityScoreCount: vi.fn(),
  opportunityScoreUpsert: vi.fn(),
  searchRunCount: vi.fn(),
  searchRunCreate: vi.fn(),
  searchRunDelete: vi.fn(),
  companyFindMany: vi.fn(),
  companyCreate: vi.fn(),
  signalCreate: vi.fn(),
  opportunityScoreSignalCreate: vi.fn(),
  parseMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: { findUnique: organizationFindUnique, update: organizationUpdate },
    iCP: { findFirst: icpFindFirst },
    opportunityScore: { count: opportunityScoreCount, upsert: opportunityScoreUpsert },
    searchRun: { count: searchRunCount, create: searchRunCreate, delete: searchRunDelete },
    company: { findMany: companyFindMany, create: companyCreate },
    signal: { create: signalCreate },
    opportunityScoreSignal: { create: opportunityScoreSignalCreate },
  },
}));

vi.mock("@anthropic-ai/sdk", () => {
  class MockAPIError extends Error {}
  class MockAnthropic {
    static APIError = MockAPIError;
    messages = { parse: parseMock };
  }
  return { default: MockAnthropic };
});

// Import depois dos vi.mock acima (hoisted pelo vitest, mas mantido nesta
// ordem por legibilidade).
const { searchOpportunities } = await import("./search");
const Anthropic = (await import("@anthropic-ai/sdk")).default;

const DAY_MS = 24 * 60 * 60 * 1000;

const baseOrg = {
  id: "org-1",
  name: "Empresa Teste",
  segment: "Tecnologia",
  city: "São Paulo",
  state: "SP",
  plan: "STARTER",
  lastSearchAt: null as Date | null,
};

const baseIcp = {
  id: "icp-1",
  segments: [] as string[],
  radiusKm: null as number | null,
  states: [] as string[],
  cities: [] as string[],
  decisionMakerTitles: [] as string[],
  technologies: [] as string[],
  keywords: [] as string[],
  productsSold: [] as string[],
  servicesSold: [] as string[],
  idealCustomerDescription: null as string | null,
  preferredSignalCategories: [] as string[],
  companiesToAvoid: [] as string[],
};

function makeApiError(message: string): Error {
  const err = new Error(message);
  Object.setPrototypeOf(err, Anthropic.APIError.prototype as object);
  return err;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test-key";
  organizationUpdate.mockResolvedValue({});
  searchRunCreate.mockResolvedValue({ id: "run-1" });
  searchRunDelete.mockResolvedValue(undefined);
  companyFindMany.mockResolvedValue([]);
  icpFindFirst.mockResolvedValue(baseIcp);
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

describe("searchOpportunities — gating", () => {
  it("retorna not_configured sem tocar no banco se não há API key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const result = await searchOpportunities("org-1");
    expect(result).toEqual({ status: "not_configured" });
    expect(organizationFindUnique).not.toHaveBeenCalled();
  });

  it("retorna erro se a organização não existe", async () => {
    organizationFindUnique.mockResolvedValueOnce(null);
    const result = await searchOpportunities("org-inexistente");
    expect(result).toEqual({ status: "error", message: "Organização não encontrada." });
  });

  it("retorna rate_limited dentro do cooldown de 2 dias", async () => {
    const lastSearchAt = new Date(Date.now() - DAY_MS); // 1 dia atrás, faltam ~1 dia
    organizationFindUnique.mockResolvedValueOnce({ ...baseOrg, lastSearchAt });
    const result = await searchOpportunities("org-1");
    expect(result.status).toBe("rate_limited");
    if (result.status === "rate_limited") {
      expect(new Date(result.nextAvailableAt).getTime()).toBe(lastSearchAt.getTime() + SEARCH_COOLDOWN_MS);
    }
    expect(icpFindFirst).not.toHaveBeenCalled();
  });

  it("libera busca quando o cooldown já passou", async () => {
    const lastSearchAt = new Date(Date.now() - 3 * DAY_MS);
    organizationFindUnique.mockResolvedValueOnce({ ...baseOrg, lastSearchAt, plan: "ENTERPRISE" });
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [] } });
    const result = await searchOpportunities("org-1");
    expect(result).toEqual({ status: "ok", count: 0 });
  });

  it("retorna erro se a organização não tem ICP ativo", async () => {
    organizationFindUnique.mockResolvedValueOnce({ ...baseOrg });
    icpFindFirst.mockResolvedValueOnce(null);
    const result = await searchOpportunities("org-1");
    expect(result).toEqual({ status: "error", message: "Cadastre um ICP antes de buscar oportunidades." });
    expect(opportunityScoreCount).not.toHaveBeenCalled();
  });

  it("retorna plan_limit quando o número de oportunidades ativas atinge o limite do plano", async () => {
    organizationFindUnique.mockResolvedValueOnce({ ...baseOrg, plan: "STARTER" });
    opportunityScoreCount.mockResolvedValueOnce(PLANS.STARTER.maxActiveOpportunities);
    const result = await searchOpportunities("org-1");
    expect(result).toEqual({ status: "plan_limit", limit: PLANS.STARTER.maxActiveOpportunities });
    expect(opportunityScoreCount).toHaveBeenCalledWith({
      where: { organizationId: "org-1", stage: null, status: { not: "DISMISSED" } },
    });
    // Deve parar aqui — não gasta uma query extra checando limite mensal.
    expect(searchRunCount).not.toHaveBeenCalled();
  });

  it("não bloqueia por plan_limit quando está abaixo do teto", async () => {
    organizationFindUnique.mockResolvedValueOnce({ ...baseOrg, plan: "STARTER" });
    opportunityScoreCount.mockResolvedValueOnce(PLANS.STARTER.maxActiveOpportunities! - 1);
    searchRunCount.mockResolvedValueOnce(0);
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [] } });
    const result = await searchOpportunities("org-1");
    expect(result).toEqual({ status: "ok", count: 0 });
  });

  it("retorna search_limit quando o número de buscas do mês atinge o teto do plano", async () => {
    organizationFindUnique.mockResolvedValueOnce({ ...baseOrg, plan: "STARTER" });
    opportunityScoreCount.mockResolvedValueOnce(0);
    searchRunCount.mockResolvedValueOnce(PLANS.STARTER.maxSearchesPerMonth);
    const result = await searchOpportunities("org-1");
    expect(result).toEqual({ status: "search_limit", limit: PLANS.STARTER.maxSearchesPerMonth });
    expect(organizationUpdate).not.toHaveBeenCalled(); // não deve gastar cooldown numa busca bloqueada
  });

  it("plano ENTERPRISE (limites null) nunca consulta contagem de oportunidades ou buscas", async () => {
    organizationFindUnique.mockResolvedValueOnce({ ...baseOrg, plan: "ENTERPRISE" });
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [] } });
    const result = await searchOpportunities("org-1");
    expect(result).toEqual({ status: "ok", count: 0 });
    expect(opportunityScoreCount).not.toHaveBeenCalled();
    expect(searchRunCount).not.toHaveBeenCalled();
  });
});

describe("searchOpportunities — falha da IA reverte o estado da organização", () => {
  beforeEach(() => {
    organizationFindUnique.mockResolvedValue({ ...baseOrg, plan: "ENTERPRISE", lastSearchAt: null });
  });

  it("desfaz lastSearchAt e apaga o SearchRun quando a chamada à IA lança um erro genérico", async () => {
    parseMock.mockRejectedValueOnce(new Error("network down"));
    const result = await searchOpportunities("org-1");
    expect(result).toEqual({ status: "error", message: "Busca falhou: Erro inesperado ao chamar a IA." });
    expect(organizationUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "org-1" },
      data: { lastSearchAt: expect.any(Date) },
    });
    expect(organizationUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "org-1" },
      data: { lastSearchAt: null },
    });
    expect(searchRunDelete).toHaveBeenCalledWith({ where: { id: "run-1" } });
  });

  it("repassa a mensagem original quando o erro é um Anthropic.APIError", async () => {
    parseMock.mockRejectedValueOnce(makeApiError("Rate limit exceeded"));
    const result = await searchOpportunities("org-1");
    expect(result).toEqual({ status: "error", message: "Busca falhou: Rate limit exceeded" });
  });

  it("desfaz lastSearchAt e apaga o SearchRun quando a IA não retorna saída estruturada", async () => {
    parseMock.mockResolvedValueOnce({ parsed_output: null });
    const result = await searchOpportunities("org-1");
    expect(result).toEqual({ status: "error", message: "A IA não retornou um resultado estruturado válido." });
    expect(organizationUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "org-1" },
      data: { lastSearchAt: null },
    });
    expect(searchRunDelete).toHaveBeenCalledWith({ where: { id: "run-1" } });
  });

  it("preserva o lastSearchAt anterior (não null) ao reverter uma falha", async () => {
    const previousLastSearchAt = new Date(Date.now() - 3 * DAY_MS);
    organizationFindUnique.mockResolvedValue({ ...baseOrg, plan: "ENTERPRISE", lastSearchAt: previousLastSearchAt });
    parseMock.mockRejectedValueOnce(new Error("boom"));
    await searchOpportunities("org-1");
    expect(organizationUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "org-1" },
      data: { lastSearchAt: previousLastSearchAt },
    });
  });
});
