import { withOrgContext } from "@/lib/db/with-org-context";
import { getCurrentMembership, getCurrentUserId } from "@/lib/auth/current-org";
import { contactDataExport } from "@/lib/crm/privacy";
import { logSecurityEvent } from "@/lib/audit/log";

// Direito de acesso (art. 18, II, LGPD): entrega, em JSON, tudo que o Spinos guarda sobre UMA pessoa,
// para o responsável repassar a ela. Só dono e administrador (é dado pessoal de terceiro).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const membership = await getCurrentMembership();
  if (!userId || !membership) return new Response("Não autenticado.", { status: 401 });
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") return new Response("Só donos e administradores.", { status: 403 });

  const data = await withOrgContext(membership.organizationId, (tx) => contactDataExport(tx, membership.organizationId, id));
  if (!data) return new Response("Contato não encontrado.", { status: 404 });
  await logSecurityEvent({ type: "privacy.contact_exported", actorUserId: userId, organizationId: membership.organizationId, targetId: id });
  return new Response(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="dados-do-contato-${id}.json"` } });
}
