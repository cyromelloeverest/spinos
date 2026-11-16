import { prismaAdmin } from "@/lib/prisma-admin";
import { processOrganizationQueue } from "@/lib/email/campaign";
import { resendProvider } from "@/lib/email/provider";
import { logError } from "@/lib/log-error";

// Fila de campanhas: a cada poucos minutos envia um lote por organização. Mesma autenticação dos outros crons.
function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) return new Response("Unauthorized", { status: 401 });
  const orgs = await prismaAdmin.emailCampaign.findMany({ where: { status: "SENDING" }, select: { organizationId: true }, distinct: ["organizationId"] });
  let sent = 0;
  let failed = 0;
  let errors = 0;
  for (const { organizationId } of orgs) {
    try {
      const r = await processOrganizationQueue(organizationId, resendProvider);
      sent += r.sent;
      failed += r.failed;
    } catch (err) {
      errors += 1;
      logError("cron/emails: falha numa organização", err, { organizationId });
    }
  }
  return Response.json({ status: errors === 0 ? "ok" : "partial", organizations: orgs.length, sent, failed, errors });
}
