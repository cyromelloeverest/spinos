import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { prismaAdmin } from "@/lib/prisma-admin";

// Usa prismaAdmin (não a conexão restrita por RLS) de propósito: essas
// funções são o que DESCOBRE qual é a organização atual — não dá pra exigir
// contexto de org já setado pra rodar a query que serve pra achar esse
// contexto. É o mesmo motivo de uma tela de login não poder exigir sessão.

// Qual organização mostrar quando o usuário pertence a mais de uma.
// Setado por switchOrganization() e ao aceitar um convite — se ausente ou
// apontando pra uma org que o usuário não é mais membro, cai no fallback
// (a membership mais recente, não a mais antiga: um convite recém-aceito
// deve levar pra org nova, não deixar o usuário preso na primeira que ele
// criou).
export const ACTIVE_ORG_COOKIE = "spinos_active_org";

export async function setActiveOrganizationCookie(organizationId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
}

export async function getCurrentOrganizationId(): Promise<string | null> {
  const membership = await getCurrentMembership();
  return membership?.organizationId ?? null;
}

export async function getCurrentMembership() {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  if (activeOrgId) {
    const membership = await prismaAdmin.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId: activeOrgId } },
    });
    if (membership) return membership;
    // Cookie aponta pra uma org que o usuário não é (mais) membro —
    // ignora e cai no fallback abaixo em vez de travar o usuário fora.
  }

  return prismaAdmin.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getUserMemberships() {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  return prismaAdmin.membership.findMany({
    where: { userId },
    include: { organization: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function isCurrentUserSuperAdmin(): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  const user = await prismaAdmin.user.findUnique({ where: { id: userId }, select: { isSuperAdmin: true } });
  return user?.isSuperAdmin ?? false;
}
