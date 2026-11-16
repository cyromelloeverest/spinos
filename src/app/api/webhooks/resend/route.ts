import { prismaAdmin } from "@/lib/prisma-admin";
import { withOrgContext } from "@/lib/db/with-org-context";
import { suppressEmail } from "@/lib/email/audience";
import { SUPPRESS_EVENTS, verifyResendWebhook, type ResendEvent } from "@/lib/email/webhook";
import { logError } from "@/lib/log-error";

// Bounce e reclamação voltam do Resend por aqui: o endereço entra na lista de supressão da organização
// dona da mensagem e nunca mais recebe campanha. Sem RESEND_WEBHOOK_SECRET a rota recusa tudo.
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook não configurado", { status: 503 });
  const body = await request.text();
  const ok = verifyResendWebhook(secret, { id: request.headers.get("svix-id"), timestamp: request.headers.get("svix-timestamp"), signature: request.headers.get("svix-signature") }, body);
  if (!ok) return new Response("Assinatura inválida", { status: 401 });

  let event: ResendEvent;
  try {
    event = JSON.parse(body) as ResendEvent;
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }
  const reason = SUPPRESS_EVENTS[event.type];
  const providerId = event.data?.email_id;
  if (!reason || !providerId) return new Response("Ignorado");

  try {
    const message = await prismaAdmin.emailMessage.findFirst({ where: { providerId }, select: { id: true, organizationId: true, email: true } });
    if (!message) return new Response("Ignorado");
    await withOrgContext(message.organizationId, async (tx) => {
      await tx.emailMessage.update({ where: { id: message.id }, data: { status: reason === "BOUNCE" ? "BOUNCED" : "COMPLAINED" } });
      await suppressEmail(tx, message.organizationId, message.email, reason);
    });
  } catch (err) {
    logError("webhooks/resend: falha", err, { providerId });
    return new Response("Erro", { status: 500 });
  }
  return new Response("OK");
}
