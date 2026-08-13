import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  organizationFindUnique,
  membershipCount,
  inviteCount,
  membershipFindFirst,
  inviteCreate,
  membershipFindUnique,
  membershipDelete,
  inviteDeleteMany,
  getCurrentMembership,
  getCurrentUserId,
  sendInviteEmail,
  logSecurityEvent,
} = vi.hoisted(() => ({
  organizationFindUnique: vi.fn(),
  membershipCount: vi.fn(),
  inviteCount: vi.fn(),
  membershipFindFirst: vi.fn(),
  inviteCreate: vi.fn(),
  membershipFindUnique: vi.fn(),
  membershipDelete: vi.fn(),
  inviteDeleteMany: vi.fn(),
  getCurrentMembership: vi.fn(),
  getCurrentUserId: vi.fn(),
  sendInviteEmail: vi.fn(),
  logSecurityEvent: vi.fn(),
}));

// withOrgContext abre uma transação e passa "tx" pra callback — no mock,
// "tx" é o mesmo objeto que "prisma", com os mesmos métodos mockados.
const mockDb = {
  organization: { findUnique: organizationFindUnique },
  membership: {
    count: membershipCount,
    findFirst: membershipFindFirst,
    findUnique: membershipFindUnique,
    delete: membershipDelete,
  },
  invite: { count: inviteCount, create: inviteCreate, deleteMany: inviteDeleteMany },
  $executeRaw: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ...mockDb,
    $transaction: vi.fn((cb: (tx: typeof mockDb) => unknown) => cb(mockDb)),
  },
}));

vi.mock("@/lib/prisma-admin", () => ({
  prismaAdmin: { invite: { findUnique: vi.fn() }, user: { upsert: vi.fn(), findUnique: vi.fn() } },
}));

vi.mock("@/lib/auth/current-org", () => ({
  getCurrentMembership,
  getCurrentUserId,
  setActiveOrganizationCookie: vi.fn(),
}));

vi.mock("@/lib/invite-email", () => ({ sendInviteEmail, INVITE_TTL_MS: 7 * 24 * 60 * 60 * 1000 }));
vi.mock("@/lib/audit/log", () => ({ logSecurityEvent }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// redirect() de verdade lança uma exceção especial que interrompe o fluxo —
// o mock precisa fazer o mesmo, senão o código continua executando depois
// de um redirect de bloqueio e os testes de permissão não significam nada.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

const { inviteMember, removeMember } = await import("./team");

function formData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.append(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  organizationFindUnique.mockResolvedValue({ id: "org-1", name: "Empresa Teste", plan: "PROFISSIONAL" });
  membershipCount.mockResolvedValue(1);
  inviteCount.mockResolvedValue(0);
  membershipFindFirst.mockResolvedValue(null);
  inviteCreate.mockResolvedValue({});
  sendInviteEmail.mockResolvedValue(undefined);
});

describe("inviteMember — papel", () => {
  // inviteMember() sempre termina em redirect("/settings/equipe?invited=1")
  // no caminho de sucesso — como o mock de redirect lança (fiel ao Next.js
  // de verdade), o próprio sucesso aparece como uma exceção esperada aqui.
  it("convida como MEMBER por padrão quando o campo role não é enviado", async () => {
    getCurrentMembership.mockResolvedValue({ organizationId: "org-1", userId: "user-1", role: "OWNER" });

    await expect(inviteMember(formData({ email: "novo@empresa.com" }))).rejects.toThrow(
      "REDIRECT:/settings/equipe?invited=1",
    );

    expect(inviteCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "MEMBER" }) }),
    );
    expect(sendInviteEmail).toHaveBeenCalledWith("novo@empresa.com", "Empresa Teste", expect.any(String), {
      isAgency: false,
    });
  });

  it("convida como AGENCY quando o campo role pede isso", async () => {
    getCurrentMembership.mockResolvedValue({ organizationId: "org-1", userId: "user-1", role: "OWNER" });

    await expect(inviteMember(formData({ email: "agencia@parceira.com", role: "AGENCY" }))).rejects.toThrow(
      "REDIRECT:/settings/equipe?invited=1",
    );

    expect(inviteCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "AGENCY" }) }),
    );
    expect(sendInviteEmail).toHaveBeenCalledWith("agencia@parceira.com", "Empresa Teste", expect.any(String), {
      isAgency: true,
    });
  });

  it("nunca aceita convidar como OWNER — cai em MEMBER", async () => {
    getCurrentMembership.mockResolvedValue({ organizationId: "org-1", userId: "user-1", role: "OWNER" });

    await expect(inviteMember(formData({ email: "novo@empresa.com", role: "OWNER" }))).rejects.toThrow(/REDIRECT:/);

    expect(inviteCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "MEMBER" }) }),
    );
  });

  it("ignora um valor de role desconhecido — cai em MEMBER", async () => {
    getCurrentMembership.mockResolvedValue({ organizationId: "org-1", userId: "user-1", role: "OWNER" });

    await expect(inviteMember(formData({ email: "novo@empresa.com", role: "SUPER_HACKER" }))).rejects.toThrow(
      /REDIRECT:/,
    );

    expect(inviteCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "MEMBER" }) }),
    );
  });
});

describe("inviteMember/removeMember — permissão de agência", () => {
  it("um membro comum (MEMBER) não pode convidar — bloqueado antes de tocar no banco", async () => {
    getCurrentMembership.mockResolvedValue({ organizationId: "org-1", userId: "user-1", role: "MEMBER" });

    await expect(inviteMember(formData({ email: "novo@empresa.com" }))).rejects.toThrow(/REDIRECT:/);

    expect(inviteCreate).not.toHaveBeenCalled();
  });

  it("acesso de AGENCY consegue convidar novos membros", async () => {
    getCurrentMembership.mockResolvedValue({ organizationId: "org-1", userId: "user-agencia", role: "AGENCY" });

    await expect(inviteMember(formData({ email: "novo@empresa.com" }))).rejects.toThrow(
      "REDIRECT:/settings/equipe?invited=1",
    );

    expect(inviteCreate).toHaveBeenCalled();
  });

  it("acesso de AGENCY consegue remover um membro da equipe", async () => {
    getCurrentMembership.mockResolvedValue({ organizationId: "org-1", userId: "user-agencia", role: "AGENCY" });
    getCurrentUserId.mockResolvedValue("user-agencia");
    membershipFindUnique.mockResolvedValue({ id: "membership-2", userId: "user-2", organizationId: "org-1" });

    await removeMember("membership-2");

    expect(membershipDelete).toHaveBeenCalledWith({ where: { id: "membership-2" } });
  });
});
