import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEARCH_COOLDOWN_MS, EMPTY_RESULT_RETRY_MS } from "./constants";
import { PLANS } from "@/lib/plans";
import { TRIAL_MAX_SEARCHES, TRIAL_MAX_ACTIVE_OPPORTUNITIES } from "@/lib/trial";

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
  signalFindFirst,
  signalCreate,
  opportunityScoreSignalUpsert,
  missionCreate,
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
  signalFindFirst: vi.fn(),
  signalCreate: vi.fn(),
  opportunityScoreSignalUpsert: vi.fn(),
  missionCreate: vi.fn(),
  parseMock: vi.fn(),
}));

// withOrgContext abre uma transação e passa "tx" pra callback — no mock,
// "tx" é o mesmo objeto que "prisma", com os mesmos métodos mockados, mais
// $executeRaw (usado só pro set_config do contexto de RLS, sem efeito aqui).
// company/signal ficam também no "prisma" de fora porque search.ts as
// chama fora de qualquer withOrgContext (são tabelas globais).
const mockDb = {
  organization: { findUnique: organizationFindUnique, update: organizationUpdate },
  iCP: { findFirst: icpFindFirst },
  opportunityScore: { count: opportunityScoreCount, upsert: opportunityScoreUpsert },
  searchRun: { count: searchRunCount, create: searchRunCreate, delete: searchRunDelete },
  company: { findMany: companyFindMany, create: companyCreate },
  signal: { findFirst: signalFindFirst, create: signalCreate },
  opportunityScoreSignal: { upsert: opportunityScoreSignalUpsert },
  mission: { create: missionCreate },
  $executeRaw: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ...mockDb,
    $transaction: vi.fn((cb: (tx: typeof mockDb) => unknown) => cb(mockDb)),
  },
}));

vi.mock("@/lib/og-image", () => ({ fetchOgImage: vi.fn().mockResolvedValue(null) }));

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
  // null = sem trial (conta paga/uso interno) — a maioria dos testes
  // existentes assume esse caso; os testes de trial sobrescrevem com uma
  // data no futuro.
  trialEndsAt: null as Date | null,
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
  averageTicketBRL: null as number | null,
  salesCycleLength: null as string | null,
  saleModel: null as string | null,
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
  signalFindFirst.mockResolvedValue(null);
  signalCreate.mockResolvedValue({ id: "signal-1" });
  opportunityScoreSignalUpsert.mockResolvedValue({});
  missionCreate.mockResolvedValue({ id: "mission-1" });
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
    expect(result).toEqual({ status: "empty" });
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
    expect(result).toEqual({ status: "empty" });
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
    expect(result).toEqual({ status: "empty" });
    expect(opportunityScoreCount).not.toHaveBeenCalled();
    expect(searchRunCount).not.toHaveBeenCalled();
  });

  it("trial nunca herda buscas ilimitadas do plano Enterprise — bloqueia no teto do trial", async () => {
    organizationFindUnique.mockResolvedValueOnce({
      ...baseOrg,
      plan: "ENTERPRISE",
      trialEndsAt: new Date(Date.now() + 3 * DAY_MS),
    });
    opportunityScoreCount.mockResolvedValueOnce(0);
    searchRunCount.mockResolvedValueOnce(TRIAL_MAX_SEARCHES);
    const result = await searchOpportunities("org-1");
    expect(result).toEqual({ status: "search_limit", limit: TRIAL_MAX_SEARCHES });
  });

  it("trial bloqueia por oportunidades ativas no teto do trial, não no teto (ilimitado) do plano selecionado", async () => {
    organizationFindUnique.mockResolvedValueOnce({
      ...baseOrg,
      plan: "ENTERPRISE",
      trialEndsAt: new Date(Date.now() + 3 * DAY_MS),
    });
    opportunityScoreCount.mockResolvedValueOnce(TRIAL_MAX_ACTIVE_OPPORTUNITIES);
    const result = await searchOpportunities("org-1");
    expect(result).toEqual({ status: "plan_limit", limit: TRIAL_MAX_ACTIVE_OPPORTUNITIES });
  });

  it("trial conta buscas de todo o período (sem filtro de mês), diferente de um plano pago", async () => {
    organizationFindUnique.mockResolvedValueOnce({
      ...baseOrg,
      plan: "STARTER",
      trialEndsAt: new Date(Date.now() + 3 * DAY_MS),
    });
    opportunityScoreCount.mockResolvedValueOnce(0);
    searchRunCount.mockResolvedValueOnce(TRIAL_MAX_SEARCHES - 1);
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [] } });

    await searchOpportunities("org-1");

    expect(searchRunCount).toHaveBeenCalledWith({ where: { organizationId: "org-1" } });
  });

  it("libera busca no trial quando está abaixo dos dois tetos", async () => {
    organizationFindUnique.mockResolvedValueOnce({
      ...baseOrg,
      plan: "ENTERPRISE",
      trialEndsAt: new Date(Date.now() + 3 * DAY_MS),
    });
    opportunityScoreCount.mockResolvedValueOnce(TRIAL_MAX_ACTIVE_OPPORTUNITIES - 1);
    searchRunCount.mockResolvedValueOnce(TRIAL_MAX_SEARCHES - 1);
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [] } });
    const result = await searchOpportunities("org-1");
    expect(result).toEqual({ status: "empty" });
  });
});

describe("searchOpportunities — saldo pré-pago de buscas extras", () => {
  it("consome 1 crédito e libera a busca quando o teto foi atingido mas há saldo", async () => {
    organizationFindUnique.mockResolvedValueOnce({ ...baseOrg, plan: "STARTER", searchCreditBalance: 3 });
    opportunityScoreCount.mockResolvedValueOnce(0);
    searchRunCount.mockResolvedValueOnce(PLANS.STARTER.maxSearchesPerMonth);
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [] } });

    const result = await searchOpportunities("org-1");

    expect(result).toEqual({ status: "empty" });
    expect(organizationUpdate).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { searchCreditBalance: { decrement: 1 } },
    });
  });

  it("bloqueia com search_limit quando o teto foi atingido e não há saldo", async () => {
    organizationFindUnique.mockResolvedValueOnce({ ...baseOrg, plan: "STARTER", searchCreditBalance: 0 });
    opportunityScoreCount.mockResolvedValueOnce(0);
    searchRunCount.mockResolvedValueOnce(PLANS.STARTER.maxSearchesPerMonth);

    const result = await searchOpportunities("org-1");

    expect(result).toEqual({ status: "search_limit", limit: PLANS.STARTER.maxSearchesPerMonth });
    expect(organizationUpdate).not.toHaveBeenCalled();
  });

  it("não mexe no saldo quando a busca é liberada normalmente, abaixo do teto", async () => {
    organizationFindUnique.mockResolvedValueOnce({ ...baseOrg, plan: "STARTER", searchCreditBalance: 3 });
    opportunityScoreCount.mockResolvedValueOnce(0);
    searchRunCount.mockResolvedValueOnce(PLANS.STARTER.maxSearchesPerMonth! - 1);
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [] } });

    await searchOpportunities("org-1");

    expect(organizationUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ searchCreditBalance: expect.anything() }) }),
    );
  });

  it("devolve o crédito consumido se a chamada à IA falhar", async () => {
    organizationFindUnique.mockResolvedValueOnce({ ...baseOrg, plan: "STARTER", searchCreditBalance: 3 });
    opportunityScoreCount.mockResolvedValueOnce(0);
    searchRunCount.mockResolvedValueOnce(PLANS.STARTER.maxSearchesPerMonth);
    parseMock.mockRejectedValueOnce(new Error("boom"));

    await searchOpportunities("org-1");

    // Ordem das chamadas nesse cenário: 1) decrementa o crédito no preCheck,
    // 2) grava lastSearchAt antes de chamar a IA, 3) desfaz tudo no catch.
    expect(organizationUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "org-1" },
      data: { searchCreditBalance: { decrement: 1 } },
    });
    expect(organizationUpdate).toHaveBeenNthCalledWith(3, {
      where: { id: "org-1" },
      data: { lastSearchAt: null, searchCreditBalance: { increment: 1 } },
    });
  });

  it("devolve o crédito consumido quando a busca volta vazia", async () => {
    organizationFindUnique.mockResolvedValueOnce({ ...baseOrg, plan: "STARTER", searchCreditBalance: 3 });
    opportunityScoreCount.mockResolvedValueOnce(0);
    searchRunCount.mockResolvedValueOnce(PLANS.STARTER.maxSearchesPerMonth);
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [] } });

    await searchOpportunities("org-1");

    expect(organizationUpdate).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        data: expect.objectContaining({ searchCreditBalance: { increment: 1 } }),
      }),
    );
  });
});

describe("searchOpportunities — prompt enviado à IA", () => {
  function lastPromptSent(): string {
    const call = parseMock.mock.calls[parseMock.mock.calls.length - 1]?.[0];
    return call.messages[0].content as string;
  }

  it("inclui ticket médio, ciclo de vendas e modelo de venda quando preenchidos no ICP", async () => {
    organizationFindUnique.mockResolvedValueOnce({ ...baseOrg, plan: "ENTERPRISE" });
    icpFindFirst.mockResolvedValueOnce({
      ...baseIcp,
      averageTicketBRL: 15000,
      salesCycleLength: "3 a 6 meses",
      saleModel: "RECORRENTE",
    });
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [] } });

    await searchOpportunities("org-1");

    const prompt = lastPromptSent();
    expect(prompt).toContain("R$ 15.000");
    expect(prompt).toContain("3 a 6 meses");
    expect(prompt).toContain("recorrente/assinatura");
  });

  it("mostra 'não informado' pros campos de perfil de venda quando o ICP não os preencheu", async () => {
    organizationFindUnique.mockResolvedValueOnce({ ...baseOrg, plan: "ENTERPRISE" });
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [] } });

    await searchOpportunities("org-1");

    const prompt = lastPromptSent();
    expect(prompt).toContain("Ticket médio de venda da contratante: não informado");
    expect(prompt).toContain("Ciclo de vendas típico da contratante: não informado");
    expect(prompt).toContain("Modelo de venda da contratante: não informado");
  });

  it("sempre instrui a IA a nunca inventar o nome do decisor", async () => {
    organizationFindUnique.mockResolvedValueOnce({ ...baseOrg, plan: "ENTERPRISE" });
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [] } });

    await searchOpportunities("org-1");

    const prompt = lastPromptSent();
    expect(prompt).toContain("Nunca invente um nome");
  });

  it("instrui a IA a ampliar a busca antes de retornar uma lista vazia", async () => {
    organizationFindUnique.mockResolvedValueOnce({ ...baseOrg, plan: "ENTERPRISE" });
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [] } });

    await searchOpportunities("org-1");

    const prompt = lastPromptSent();
    expect(prompt).toContain("AMPLIE a busca");
  });
});

describe("searchOpportunities — resultado vazio não consome cota nem cooldown inteiro", () => {
  beforeEach(() => {
    organizationFindUnique.mockResolvedValue({ ...baseOrg, plan: "ENTERPRISE", lastSearchAt: null });
  });

  it("retorna status empty e não cria Mission quando a IA não encontra nada", async () => {
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [] } });
    const result = await searchOpportunities("org-1");
    expect(result).toEqual({ status: "empty" });
    expect(missionCreate).not.toHaveBeenCalled();
  });

  it("apaga o SearchRun criado — não deve contar contra a cota mensal/trial", async () => {
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [] } });
    await searchOpportunities("org-1");
    expect(searchRunDelete).toHaveBeenCalledWith({ where: { id: "run-1" } });
  });

  it("reduz o cooldown pra EMPTY_RESULT_RETRY_MS em vez dos 2 dias inteiros", async () => {
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [] } });
    await searchOpportunities("org-1");

    const secondUpdateCall = organizationUpdate.mock.calls[1][0] as { data: { lastSearchAt: Date } };
    const nextAvailableAt = secondUpdateCall.data.lastSearchAt.getTime() + SEARCH_COOLDOWN_MS;

    expect(nextAvailableAt).toBeLessThanOrEqual(Date.now() + EMPTY_RESULT_RETRY_MS + 1000);
    expect(nextAvailableAt).toBeGreaterThan(Date.now() + EMPTY_RESULT_RETRY_MS - 60_000);
  });
});

describe("searchOpportunities — persistência de decisionMakerName", () => {
  const baseOpportunity = {
    companyName: "Vetnil Nutrição Animal",
    city: "Louveira",
    state: "SP",
    score: 88,
    urgency: "ALTA",
    headline: "Abriu vaga de gerente comercial",
    execSummary: "Resumo.",
    reasoning: "Racional.",
    buyerArea: "Comercial",
    decisionMaker: "Gerente Comercial",
    approach: "Abordagem.",
    commercialArguments: [],
    objections: [],
    signals: [],
  };

  beforeEach(() => {
    organizationFindUnique.mockResolvedValue({ ...baseOrg, plan: "ENTERPRISE" });
    companyFindMany.mockResolvedValue([]);
    companyCreate.mockResolvedValue({ id: "company-1", name: "Vetnil Nutrição Animal", city: "Louveira", state: "SP" });
    opportunityScoreUpsert.mockResolvedValue({ id: "score-1" });
  });

  it("grava o nome real quando a IA encontra um", async () => {
    parseMock.mockResolvedValueOnce({
      parsed_output: { opportunities: [{ ...baseOpportunity, decisionMakerName: "Ana Ferreira" }] },
    });

    await searchOpportunities("org-1");

    expect(opportunityScoreUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ decisionMakerName: "Ana Ferreira" }),
        create: expect.objectContaining({ decisionMakerName: "Ana Ferreira" }),
      }),
    );
  });

  it("não apaga um nome já salvo quando a IA não encontra nenhum dessa vez (undefined, não null, no update)", async () => {
    parseMock.mockResolvedValueOnce({
      parsed_output: { opportunities: [{ ...baseOpportunity, decisionMakerName: null }] },
    });

    await searchOpportunities("org-1");

    expect(opportunityScoreUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ decisionMakerName: undefined }),
        create: expect.objectContaining({ decisionMakerName: null }),
      }),
    );
  });
});

describe("searchOpportunities — falha da IA reverte o estado da organização", () => {
  beforeEach(() => {
    organizationFindUnique.mockResolvedValue({ ...baseOrg, plan: "ENTERPRISE", lastSearchAt: null });
  });

  it("desfaz lastSearchAt e apaga o SearchRun quando a chamada à IA lança um erro genérico", async () => {
    parseMock.mockRejectedValueOnce(new Error("network down"));
    const result = await searchOpportunities("org-1");
    expect(result).toEqual({ status: "error", message: "Não foi possível completar a busca agora. Tente novamente em instantes." });
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

  // Não repassa err.message pro cliente mesmo quando é um Anthropic.APIError
  // (OWASP A10) — pode conter detalhe interno tipo "credit balance too low",
  // que é estado de billing nosso, não do cliente. Mensagem genérica sempre,
  // o detalhe real vai só pro log do servidor.
  it("não repassa a mensagem original quando o erro é um Anthropic.APIError", async () => {
    parseMock.mockRejectedValueOnce(makeApiError("Rate limit exceeded"));
    const result = await searchOpportunities("org-1");
    expect(result).toEqual({ status: "error", message: "Não foi possível completar a busca agora. Tente novamente em instantes." });
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

describe("searchOpportunities — missão e dedup de sinais", () => {
  const baseOpportunity = {
    companyName: "Vetnil Nutrição Animal",
    city: "Louveira",
    state: "SP",
    score: 88,
    urgency: "ALTA",
    headline: "Abriu vaga de gerente comercial",
    execSummary: "Resumo.",
    reasoning: "Racional.",
    buyerArea: "Comercial",
    decisionMaker: "Gerente Comercial",
    decisionMakerName: null,
    approach: "Abordagem.",
    commercialArguments: [],
    objections: [],
    signals: [
      {
        category: "HIRING",
        text: "Abriu vaga de gerente comercial",
        sourceUrl: "https://exemplo.com/vaga",
        sourceLabel: "Exemplo",
      },
    ],
  };

  beforeEach(() => {
    organizationFindUnique.mockResolvedValue({ ...baseOrg, plan: "ENTERPRISE" });
    companyFindMany.mockResolvedValue([]);
    companyCreate.mockResolvedValue({ id: "company-1", name: "Vetnil Nutrição Animal", city: "Louveira", state: "SP" });
    opportunityScoreUpsert.mockResolvedValue({ id: "score-1" });
  });

  it("cria uma Mission e associa às oportunidades da busca quando há resultados", async () => {
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [baseOpportunity] } });

    await searchOpportunities("org-1");

    expect(missionCreate).toHaveBeenCalledWith({ data: { organizationId: "org-1" } });
    expect(opportunityScoreUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ missionId: "mission-1" }),
        create: expect.objectContaining({ missionId: "mission-1" }),
      }),
    );
  });

  it("não cria Mission quando a busca não retorna oportunidades", async () => {
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [] } });

    await searchOpportunities("org-1");

    expect(missionCreate).not.toHaveBeenCalled();
  });

  it("reaproveita um Signal existente (mesma empresa+sourceUrl) em vez de duplicar", async () => {
    signalFindFirst.mockResolvedValueOnce({ id: "signal-existente" });
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [baseOpportunity] } });

    await searchOpportunities("org-1");

    expect(signalFindFirst).toHaveBeenCalledWith({
      where: { companyId: "company-1", sourceUrl: "https://exemplo.com/vaga" },
    });
    expect(signalCreate).not.toHaveBeenCalled();
    expect(opportunityScoreSignalUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { opportunityScoreId: "score-1", signalId: "signal-existente" },
      }),
    );
  });

  it("cria um Signal novo quando não existe um com a mesma empresa+sourceUrl", async () => {
    signalFindFirst.mockResolvedValueOnce(null);
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [baseOpportunity] } });

    await searchOpportunities("org-1");

    expect(signalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: "company-1", sourceUrl: "https://exemplo.com/vaga" }),
      }),
    );
  });
});
