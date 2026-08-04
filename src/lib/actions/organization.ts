"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, setActiveOrganizationCookie } from "@/lib/auth/current-org";

export async function switchOrganization(organizationId: string) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });

  // Se o usuário não é membro dessa org (cookie adulterado, ou removido da
  // equipe entre o carregamento da página e o clique), ignora em silêncio —
  // o fallback de getCurrentMembership() cuida de mostrar uma org válida.
  if (membership) {
    await setActiveOrganizationCookie(organizationId);
  }

  redirect("/");
}
