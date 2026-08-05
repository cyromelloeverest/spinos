import { beforeEach, describe, expect, it, vi } from "vitest";

const { icpUpdate, getCurrentOrganizationId } = vi.hoisted(() => ({
  icpUpdate: vi.fn(),
  getCurrentOrganizationId: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { iCP: { update: icpUpdate } },
}));

vi.mock("@/lib/auth/current-org", () => ({ getCurrentOrganizationId }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { updateICP } = await import("./settings");

function formData(entries: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) {
      for (const v of value) fd.append(key, v);
    } else {
      fd.append(key, value);
    }
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentOrganizationId.mockResolvedValue("org-1");
  icpUpdate.mockResolvedValue({});
});

describe("updateICP — perfil de venda", () => {
  it("converte ticket médio pra número e guarda o ciclo de vendas como texto", async () => {
    await updateICP("icp-1", formData({ averageTicketBRL: "15000", salesCycleLength: "3 a 6 meses" }));

    expect(icpUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ averageTicketBRL: 15000, salesCycleLength: "3 a 6 meses" }),
      }),
    );
  });

  it("aceita PONTUAL e RECORRENTE como modelo de venda", async () => {
    await updateICP("icp-1", formData({ saleModel: "RECORRENTE" }));
    expect(icpUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ saleModel: "RECORRENTE" }) }));

    await updateICP("icp-1", formData({ saleModel: "PONTUAL" }));
    expect(icpUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ saleModel: "PONTUAL" }) }));
  });

  it("descarta um valor de modelo de venda inválido em vez de gravar lixo", async () => {
    await updateICP("icp-1", formData({ saleModel: "ALGO_INVENTADO" }));
    expect(icpUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ saleModel: null }) }));
  });

  it("trata campos vazios como null em vez de string vazia ou NaN", async () => {
    await updateICP("icp-1", formData({}));

    expect(icpUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ averageTicketBRL: null, salesCycleLength: null, saleModel: null }),
      }),
    );
  });
});
