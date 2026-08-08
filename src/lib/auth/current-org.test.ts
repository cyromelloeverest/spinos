import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  membershipFindUnique,
  membershipFindFirst,
  membershipFindMany,
  userFindUnique,
  getClaims,
  cookieGet,
  cookieSet,
} = vi.hoisted(() => ({
  membershipFindUnique: vi.fn(),
  membershipFindFirst: vi.fn(),
  membershipFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  getClaims: vi.fn(),
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
}));

vi.mock("@/lib/prisma-admin", () => ({
  prismaAdmin: {
    membership: { findUnique: membershipFindUnique, findFirst: membershipFindFirst, findMany: membershipFindMany },
    user: { findUnique: userFindUnique },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims } }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet, set: cookieSet }),
}));

const {
  getCurrentMembership,
  getUserMemberships,
  getCurrentOrganizationId,
  setActiveOrganizationCookie,
  isCurrentUserSuperAdmin,
  ACTIVE_ORG_COOKIE,
} = await import("./current-org");

beforeEach(() => {
  vi.clearAllMocks();
  cookieGet.mockReturnValue(undefined);
});

describe("getCurrentMembership", () => {
  it("retorna null sem consultar o banco quando não há usuário logado", async () => {
    getClaims.mockResolvedValue({ data: null });
    const result = await getCurrentMembership();
    expect(result).toBeNull();
    expect(membershipFindUnique).not.toHaveBeenCalled();
    expect(membershipFindFirst).not.toHaveBeenCalled();
  });

  it("sem cookie de org ativa, cai na membership mais recente (createdAt desc)", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    cookieGet.mockReturnValue(undefined);
    const mostRecent = { userId: "user-1", organizationId: "org-recent" };
    membershipFindFirst.mockResolvedValue(mostRecent);

    const result = await getCurrentMembership();

    expect(result).toBe(mostRecent);
    expect(membershipFindUnique).not.toHaveBeenCalled();
    expect(membershipFindFirst).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("com cookie apontando pra uma org válida, usa essa membership sem cair no fallback", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    cookieGet.mockReturnValue({ value: "org-cookie" });
    const cookieMembership = { userId: "user-1", organizationId: "org-cookie" };
    membershipFindUnique.mockResolvedValue(cookieMembership);

    const result = await getCurrentMembership();

    expect(result).toBe(cookieMembership);
    expect(membershipFindUnique).toHaveBeenCalledWith({
      where: { userId_organizationId: { userId: "user-1", organizationId: "org-cookie" } },
    });
    expect(membershipFindFirst).not.toHaveBeenCalled();
  });

  it("com cookie apontando pra uma org da qual o usuário não é mais membro, cai no fallback em vez de travar", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    cookieGet.mockReturnValue({ value: "org-removido" });
    membershipFindUnique.mockResolvedValue(null);
    const fallback = { userId: "user-1", organizationId: "org-valido" };
    membershipFindFirst.mockResolvedValue(fallback);

    const result = await getCurrentMembership();

    expect(result).toBe(fallback);
  });
});

describe("getCurrentOrganizationId", () => {
  it("retorna null quando não há membership", async () => {
    getClaims.mockResolvedValue({ data: null });
    expect(await getCurrentOrganizationId()).toBeNull();
  });

  it("retorna o organizationId da membership resolvida", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    cookieGet.mockReturnValue(undefined);
    membershipFindFirst.mockResolvedValue({ userId: "user-1", organizationId: "org-x" });
    expect(await getCurrentOrganizationId()).toBe("org-x");
  });
});

describe("getUserMemberships", () => {
  it("retorna lista vazia sem consultar o banco quando não há usuário logado", async () => {
    getClaims.mockResolvedValue({ data: null });
    expect(await getUserMemberships()).toEqual([]);
    expect(membershipFindMany).not.toHaveBeenCalled();
  });

  it("lista todas as organizações do usuário, da mais antiga pra mais nova", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    const memberships = [
      { organizationId: "org-1", organization: { name: "Empresa A" } },
      { organizationId: "org-2", organization: { name: "Empresa B" } },
    ];
    membershipFindMany.mockResolvedValue(memberships);

    const result = await getUserMemberships();

    expect(result).toBe(memberships);
    expect(membershipFindMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      include: { organization: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
  });
});

describe("isCurrentUserSuperAdmin", () => {
  it("retorna false sem usuário logado", async () => {
    getClaims.mockResolvedValue({ data: null });
    expect(await isCurrentUserSuperAdmin()).toBe(false);
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("retorna true quando isSuperAdmin está marcado", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    userFindUnique.mockResolvedValue({ isSuperAdmin: true });
    expect(await isCurrentUserSuperAdmin()).toBe(true);
  });

  it("retorna false quando o usuário não é super admin", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    userFindUnique.mockResolvedValue({ isSuperAdmin: false });
    expect(await isCurrentUserSuperAdmin()).toBe(false);
  });
});

describe("setActiveOrganizationCookie", () => {
  it("seta o cookie com as opções de segurança corretas", async () => {
    await setActiveOrganizationCookie("org-42");

    expect(cookieSet).toHaveBeenCalledWith(
      ACTIVE_ORG_COOKIE,
      "org-42",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      }),
    );
  });
});
