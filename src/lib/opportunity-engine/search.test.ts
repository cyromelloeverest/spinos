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
  searchUsageLogCreate,
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
  searchUsageLogCreate: vi.fn(),
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
  searchUsageLog: { create: searchUsageLogCreate },
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
const { searchOpportunities, searchSpecificCompany } = await import("./search");
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
  searchUsageLogCreate.mockResolvedValue({ id: "usage-1" });
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

  it("plano ENTERPRISE também bloqueia no teto — não é mais ilimitado", async () => {
    organizationFindUnique.mockResolvedValueOnce({ ...baseOrg, plan: "ENTERPRISE" });
    opportunityScoreCount.mockResolvedValueOnce(0);
    searchRunCount.mockResolvedValueOnce(PLANS.ENTERPRISE.maxSearchesPerMonth);
    const result = await searchOpportunities("org-1");
    expect(result).toEqual({ status: "search_limit", limit: PLANS.ENTERPRISE.maxSearchesPerMonth });
  });

  it("ENTERPRISE pago fora de trial não usa saldo pré-pago no teto de buscas — vira search_limit mesmo com crédito", async () => {
    organizationFindUnique.mockResolvedValueOnce({ ...baseOrg, plan: "ENTERPRISE", searchCreditBalance: 5 });
    opportunityScoreCount.mockResolvedValueOnce(0);
    searchRunCount.mockResolvedValueOnce(PLANS.ENTERPRISE.maxSearchesPerMonth);
    const result = await searchOpportunities("org-1");
    expect(result).toEqual({ status: "search_limit", limit: PLANS.ENTERPRISE.maxSearchesPerMonth });
    expect(organizationUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ searchCreditBalance: expect.anything() }) }),
    );
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

describe("searchSpecificCompany — busca dirigida", () => {
  function lastPromptSent(): string {
    const call = parseMock.mock.calls[parseMock.mock.calls.length - 1]?.[0];
    return call.messages[0].content as string;
  }

  const baseOpportunity = {
    companyName: "Vetnil Nutrição Animal",
    city: "Louveira",
    state: "SP",
    score: 62,
    urgency: "MEDIA",
    headline: "Sem sinal forte de compra no momento",
    execSummary: "Resumo.",
    reasoning: "Não encontramos sinal público recente, mas segue no raio de atuação.",
    buyerArea: "Comercial",
    decisionMaker: "Gerente Comercial",
    decisionMakerName: null,
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

  it("inclui o nome e a localização da empresa-alvo no prompt", async () => {
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [baseOpportunity] } });

    await searchSpecificCompany("org-1", "Vetnil Nutrição Animal", "Louveira, SP");

    const prompt = lastPromptSent();
    expect(prompt).toContain("EMPRESA-ALVO PRA ANALISAR (e só ela): Vetnil Nutrição Animal — Louveira, SP");
    expect(prompt).toContain("análise dirigida");
  });

  it("funciona sem localização informada (opcional)", async () => {
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [baseOpportunity] } });

    await searchSpecificCompany("org-1", "Vetnil Nutrição Animal", null);

    const prompt = lastPromptSent();
    expect(prompt).toContain("EMPRESA-ALVO PRA ANALISAR (e só ela): Vetnil Nutrição Animal\n");
  });

  it("persiste a oportunidade retornada, mesmo com score baixo/sem sinal forte", async () => {
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [baseOpportunity] } });

    const result = await searchSpecificCompany("org-1", "Vetnil Nutrição Animal", "Louveira, SP");

    expect(result).toEqual({ status: "ok", count: 1 });
    expect(opportunityScoreUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ score: 62, headline: baseOpportunity.headline }) }),
    );
  });

  it("compartilha o mesmo cooldown/cota da busca aberta — bloqueia em rate_limited", async () => {
    const lastSearchAt = new Date(Date.now() - DAY_MS);
    organizationFindUnique.mockResolvedValueOnce({ ...baseOrg, lastSearchAt, plan: "ENTERPRISE" });

    const result = await searchSpecificCompany("org-1", "Vetnil Nutrição Animal", null);

    expect(result.status).toBe("rate_limited");
    expect(parseMock).not.toHaveBeenCalled();
  });

  it("retorna empty (sem gastar cota/cooldown inteiro) quando a IA não confirma a empresa", async () => {
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [] } });

    const result = await searchSpecificCompany("org-1", "Empresa Que Não Existe Ltda", null);

    expect(result).toEqual({ status: "empty" });
  });
});

describe("searchOpportunities — não fabrica fato (regressão do caso Furnax)", () => {
  const opportunityWithFakeSource = {
    companyName: "Empresa Sem Fonte Real",
    city: null as string | null,
    state: null as string | null,
    score: 42,
    urgency: "BAIXA",
    headline: "Sem sinal forte",
    execSummary: "Resumo.",
    reasoning: "Sem confirmação pública.",
    buyerArea: "Comercial",
    decisionMaker: "Sócio-Diretor",
    decisionMakerName: null,
    approach: "Abordagem.",
    commercialArguments: [],
    objections: [],
    signals: [
      {
        category: "ICP_MATCH",
        text: "Encaixe de perfil",
        sourceUrl: "https://www.google.com/search?q=Empresa+Sem+Fonte+Real",
        sourceLabel: "Google",
      },
      {
        category: "HIRING",
        text: "Vaga real encontrada",
        sourceUrl: "https://exemplo.com/vaga-real",
        sourceLabel: "Exemplo",
      },
    ],
  };

  beforeEach(() => {
    organizationFindUnique.mockResolvedValue({ ...baseOrg, plan: "ENTERPRISE" });
    companyFindMany.mockResolvedValue([]);
    companyCreate.mockResolvedValue({ id: "company-1", name: "Empresa Sem Fonte Real", city: null, state: null });
    opportunityScoreUpsert.mockResolvedValue({ id: "score-1" });
    signalFindFirst.mockResolvedValue(null);
    signalCreate.mockResolvedValue({ id: "signal-1" });
  });

  it("descarta sinal cujo sourceUrl é uma página de resultado de busca, mas mantém a oportunidade e o sinal real", async () => {
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [opportunityWithFakeSource] } });

    const result = await searchOpportunities("org-1");

    expect(result).toEqual({ status: "ok", count: 1 });
    expect(signalCreate).toHaveBeenCalledTimes(1);
    expect(signalCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sourceUrl: "https://exemplo.com/vaga-real" }) }),
    );
    expect(signalCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sourceUrl: expect.stringContaining("google.com/search") }) }),
    );
  });

  it("persiste city/state null sem quebrar, em vez de exigir um valor chutado", async () => {
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [opportunityWithFakeSource] } });

    await searchOpportunities("org-1");

    expect(companyCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ city: null, state: null }) }),
    );
  });
});

describe("logSearchUsage — custo real por busca (item 4 do brief 2026-08-11)", () => {
  const usage = {
    input_tokens: 1000,
    output_tokens: 2000,
    cache_creation_input_tokens: 500,
    cache_read_input_tokens: 200,
    server_tool_use: { web_search_requests: 4 },
  };
  // (1000 + 500 + 200) / 1e6 * 5 + 2000 / 1e6 * 25 + 4 * 0.01
  const expectedCostUSD = (1700 / 1_000_000) * 5 + (2000 / 1_000_000) * 25 + 4 * 0.01;

  beforeEach(() => {
    organizationFindUnique.mockResolvedValue({ ...baseOrg, plan: "ENTERPRISE" });
    companyFindMany.mockResolvedValue([]);
    companyCreate.mockResolvedValue({ id: "company-1", name: "Empresa X", city: "SP", state: "SP" });
    opportunityScoreUpsert.mockResolvedValue({ id: "score-1" });
  });

  it("loga uso e custo real numa busca aberta bem-sucedida (mode: discovery, outcome: ok)", async () => {
    parseMock.mockResolvedValueOnce({
      parsed_output: {
        opportunities: [
          {
            companyName: "Empresa X",
            city: "SP",
            state: "SP",
            score: 70,
            urgency: "MEDIA",
            headline: "H",
            execSummary: "E",
            reasoning: "R",
            buyerArea: "Comercial",
            decisionMaker: "Diretor",
            decisionMakerName: null,
            approach: "A",
            commercialArguments: [],
            objections: [],
            signals: [],
          },
        ],
      },
      usage,
    });

    await searchOpportunities("org-1");

    expect(searchUsageLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        mode: "discovery",
        outcome: "ok",
        inputTokens: 1000,
        outputTokens: 2000,
        cacheCreationTokens: 500,
        cacheReadTokens: 200,
        webSearchCount: 4,
        estimatedCostUSD: expectedCostUSD,
      }),
    });
  });

  it("loga com outcome empty quando a busca não acha nada — o custo foi incorrido de qualquer jeito", async () => {
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [] }, usage });

    await searchOpportunities("org-1");

    expect(searchUsageLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ mode: "discovery", outcome: "empty", estimatedCostUSD: expectedCostUSD }),
    });
  });

  it("loga com mode targeted numa busca dirigida", async () => {
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [] }, usage });

    await searchSpecificCompany("org-1", "Empresa X", null);

    expect(searchUsageLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ mode: "targeted", outcome: "empty" }),
    });
  });

  it("não lança e não quebra a busca quando a resposta não tem usage (defensivo)", async () => {
    parseMock.mockResolvedValueOnce({ parsed_output: { opportunities: [] } });

    const result = await searchOpportunities("org-1");

    expect(result).toEqual({ status: "empty" });
    expect(searchUsageLogCreate).not.toHaveBeenCalled();
  });
});
