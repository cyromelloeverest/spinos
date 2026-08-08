"use server";

import { redirect } from "next/navigation";
import { prismaAdmin } from "@/lib/prisma-admin";
import { getCurrentUserId, setActiveOrganizationCookie } from "@/lib/auth/current-org";

// prismaAdmin de propósito: aqui é onde a gente CONFERE se o usuário pode
// entrar numa org (a org de destino ainda não é "o contexto atual" —
// é exatamente isso que essa checagem decide).
export async function switchOrganization(organizationId: string) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const membership = await prismaAdmin.membership.findUnique({
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
