import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

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

  return prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function isCurrentUserSuperAdmin(): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isSuperAdmin: true } });
  return user?.isSuperAdmin ?? false;
}
