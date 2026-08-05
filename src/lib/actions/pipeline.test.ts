import { beforeEach, describe, expect, it, vi } from "vitest";

const { opportunityScoreUpdate, feedbackUpsert, feedbackDeleteMany, getCurrentOrganizationId, getCurrentUserId } =
  vi.hoisted(() => ({
    opportunityScoreUpdate: vi.fn(),
    feedbackUpsert: vi.fn(),
    feedbackDeleteMany: vi.fn(),
    getCurrentOrganizationId: vi.fn(),
    getCurrentUserId: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    opportunityScore: { update: opportunityScoreUpdate },
    feedback: { upsert: feedbackUpsert, deleteMany: feedbackDeleteMany },
  },
}));

vi.mock("@/lib/auth/current-org", () => ({
  getCurrentOrganizationId,
  getCurrentUserId,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { setStage } = await import("./pipeline");

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentOrganizationId.mockResolvedValue("org-1");
  getCurrentUserId.mockResolvedValue("user-1");
  opportunityScoreUpdate.mockResolvedValue({ id: "opp-1", companyId: "company-1" });
});

describe("setStage — captura de Feedback", () => {
  it("grava Feedback CONVERTED ao mover pra VENDIDO", async () => {
    await setStage("opp-1", "VENDIDO");

    expect(feedbackUpsert).toHaveBeenCalledWith({
      where: { opportunityScoreId: "opp-1" },
      update: { outcome: "CONVERTED", notes: null },
      create: {
        organizationId: "org-1",
        companyId: "company-1",
        opportunityScoreId: "opp-1",
        outcome: "CONVERTED",
      },
    });
    expect(feedbackDeleteMany).not.toHaveBeenCalled();
  });

  it("grava Feedback com o motivo escolhido ao mover pra PERDIDO", async () => {
    await setStage("opp-1", "PERDIDO", "WRONG_FIT", "Não tinha orçamento nesse ciclo.");

    expect(feedbackUpsert).toHaveBeenCalledWith({
      where: { opportunityScoreId: "opp-1" },
      update: { outcome: "WRONG_FIT", notes: "Não tinha orçamento nesse ciclo." },
      create: {
        organizationId: "org-1",
        companyId: "company-1",
        opportunityScoreId: "opp-1",
        outcome: "WRONG_FIT",
        notes: "Não tinha orçamento nesse ciclo.",
      },
    });
  });

  it("usa NOT_INTERESTED como fallback se PERDIDO vier sem motivo", async () => {
    await setStage("opp-1", "PERDIDO");

    expect(feedbackUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ outcome: "NOT_INTERESTED" }) }),
    );
  });

  it("trata notas em branco como null, não como string vazia", async () => {
    await setStage("opp-1", "PERDIDO", "NO_RESPONSE", "   ");

    expect(feedbackUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { outcome: "NO_RESPONSE", notes: null } }),
    );
  });

  it("apaga o Feedback ao sair de um estágio terminal (voltou pro funil)", async () => {
    await setStage("opp-1", "VISITA_AGENDADA");

    expect(feedbackDeleteMany).toHaveBeenCalledWith({ where: { opportunityScoreId: "opp-1" } });
    expect(feedbackUpsert).not.toHaveBeenCalled();
  });

  it("também limpa qualquer Feedback anterior em estágios intermediários (CONTATO_FEITO)", async () => {
    await setStage("opp-1", "CONTATO_FEITO");

    expect(feedbackDeleteMany).toHaveBeenCalledWith({ where: { opportunityScoreId: "opp-1" } });
    expect(feedbackUpsert).not.toHaveBeenCalled();
  });
});
