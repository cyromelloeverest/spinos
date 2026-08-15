import { prismaAdmin } from "@/lib/prisma-admin";
import { logError } from "@/lib/log-error";
import {
  shouldSendTrialNoSearchEmail,
  shouldSendTrialEndingEmail,
  shouldSendStaleOpportunitiesEmail,
  sendTrialNoSearchEmail,
  sendTrialEndingEmail,
  sendStaleOpportunitiesEmail,
  STALE_OPPORTUNITIES_AFTER_DAYS,
} from "@/lib/lifecycle-emails";

// Mesmo mecanismo de auth do cron de coleta gratuita (ver
// src/app/api/cron/collect-signals/route.ts) — header injetado pelo
// Vercel Cron quando CRON_SECRET está configurado.
function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Um loop simples por organização, com algumas queries cada — igual ao
// cron de coleta gratuita, cobre bem o volume atual (poucas dezenas de
// organizações). Paralelizar/otimizar só faz sentido se a base crescer
// bastante.
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  let trialNoSearchSent = 0;
  let trialEndingSent = 0;
  let staleOpportunitiesSent = 0;

  try {
    const orgs = await prismaAdmin.organization.findMany({
      where: { lifecycleEmailsOptOut: false },
      select: {
        id: true,
        name: true,
        createdAt: true,
        trialEndsAt: true,
        lifecycleEmailsOptOut: true,
        trialNoSearchEmailSentAt: true,
        trialEndingEmailSentAt: true,
        staleOpportunitiesEmailSentAt: true,
      },
    });

    for (const org of orgs) {
      const owner = await prismaAdmin.membership.findFirst({
        where: { organizationId: org.id, role: "OWNER" },
        include: { user: true },
      });
      if (!owner?.user.email) continue;

      try {
        if (shouldSendTrialNoSearchEmail(org, await countSearchRuns(org.id), now)) {
          await sendTrialNoSearchEmail({
            organizationId: org.id,
            to: owner.user.email,
            name: owner.user.name,
            trialEndsAt: org.trialEndsAt!,
          });
          await prismaAdmin.organization.update({ where: { id: org.id }, data: { trialNoSearchEmailSentAt: now } });
          trialNoSearchSent++;
        }

        if (shouldSendTrialEndingEmail(org, now)) {
          const activeCount = await countActiveOpportunities(org.id);
          const daysRemaining = Math.max(1, Math.ceil((org.trialEndsAt!.getTime() - now.getTime()) / DAY_MS));
          await sendTrialEndingEmail({
            organizationId: org.id,
            to: owner.user.email,
            name: owner.user.name,
            trialEndsAt: org.trialEndsAt!,
            daysRemaining,
            opportunitiesCount: activeCount,
          });
          await prismaAdmin.organization.update({ where: { id: org.id }, data: { trialEndingEmailSentAt: now } });
          trialEndingSent++;
        }

        const staleCount = await countStaleOpportunities(org.id, now);
        if (shouldSendStaleOpportunitiesEmail(org, staleCount, now)) {
          await sendStaleOpportunitiesEmail({
            organizationId: org.id,
            to: owner.user.email,
            name: owner.user.name,
            opportunitiesCount: staleCount,
            daysStale: STALE_OPPORTUNITIES_AFTER_DAYS,
          });
          await prismaAdmin.organization.update({ where: { id: org.id }, data: { staleOpportunitiesEmailSentAt: now } });
          staleOpportunitiesSent++;
        }
      } catch (err) {
        // Falha numa organização não pode derrubar o envio das outras.
        logError("cron/lifecycle-emails: falha ao processar organização", err, { organizationId: org.id });
      }
    }

    return Response.json({ status: "ok", trialNoSearchSent, trialEndingSent, staleOpportunitiesSent });
  } catch (err) {
    logError("cron/lifecycle-emails: falha geral", err);
    return Response.json({ status: "error" }, { status: 500 });
  }
}

function countSearchRuns(organizationId: string): Promise<number> {
  return prismaAdmin.searchRun.count({ where: { organizationId } });
}

function countActiveOpportunities(organizationId: string): Promise<number> {
  return prismaAdmin.opportunityScore.count({
    where: { organizationId, stage: null, status: { not: "DISMISSED" } },
  });
}

function countStaleOpportunities(organizationId: string, now: Date): Promise<number> {
  const staleThreshold = new Date(now.getTime() - STALE_OPPORTUNITIES_AFTER_DAYS * DAY_MS);
  return prismaAdmin.opportunityScore.count({
    where: { organizationId, stage: null, status: { not: "DISMISSED" }, computedAt: { lte: staleThreshold } },
  });
}
