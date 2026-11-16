import { prismaAdmin } from "@/lib/prisma-admin";
import { withOrgContext } from "@/lib/db/with-org-context";
import { runRetention } from "@/lib/privacy/retention";
import { logError } from "@/lib/log-error";

function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export const maxDuration = 60;

// Retenção de dados (LGPD): roda todo dia, organização por organização, cada uma no próprio contexto.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) return new Response("Unauthorized", { status: 401 });
  const orgs = await prismaAdmin.organization.findMany({ select: { id: true } });
  const total = { siteEventsDeleted: 0, emailRecipientsScrubbed: 0, draftsDeleted: 0 };
  let failed = 0;
  for (const { id } of orgs) {
    try {
      const r = await withOrgContext(id, (tx) => runRetention(tx, id));
      total.siteEventsDeleted += r.siteEventsDeleted;
      total.emailRecipientsScrubbed += r.emailRecipientsScrubbed;
      total.draftsDeleted += r.draftsDeleted;
    } catch (err) {
      failed += 1;
      logError("cron/retention: falha numa organização", err, { organizationId: id });
    }
  }
  return Response.json({ status: failed === 0 ? "ok" : "partial", organizations: orgs.length, ...total, failed });
}
