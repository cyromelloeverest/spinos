import { prismaAdmin } from "@/lib/prisma-admin";
import { withOrgContext } from "@/lib/db/with-org-context";
import { runTimeAutomations } from "@/lib/automations/engine";
import { logError } from "@/lib/log-error";

// Rotina de tempo das automações (prazo de lead, negociação sem próximo passo), a
// cada 5 minutos. Mesmo mecanismo de auth dos outros crons: o Vercel Cron injeta o
// header quando CRON_SECRET está configurado.
function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) return new Response("Unauthorized", { status: 401 });

  // Só organizações com alguma receita ligada (lista cross-org: usa o papel administrativo).
  const orgs = await prismaAdmin.automation.findMany({ where: { enabled: true }, select: { organizationId: true }, distinct: ["organizationId"] });
  let created = 0;
  let failed = 0;
  for (const { organizationId } of orgs) {
    try {
      const r = await withOrgContext(organizationId, (tx) => runTimeAutomations(tx, organizationId));
      created += r.created;
    } catch (err) {
      failed++;
      logError("cron/automations: falha numa organização", err, { organizationId });
    }
  }
  return Response.json({ status: failed === 0 ? "ok" : "partial", organizations: orgs.length, created, failed });
}
