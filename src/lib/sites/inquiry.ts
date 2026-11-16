import "server-only";
import { prismaAdmin } from "@/lib/prisma-admin";
import { withOrgContext } from "@/lib/db/with-org-context";
import { createLead, DuplicateLeadError } from "@/lib/crm/leads";
import { leadOverLimit } from "@/lib/sites/events";
import { scheduleActivity } from "@/lib/crm/activities";
import { escapeHtml } from "@/lib/html-escape";
import { SITE_URL } from "@/lib/site-url";
import { logError } from "@/lib/log-error";

export type PublicLeadInput = {
  organizationId: string;
  siteId: string;
  host: string;
  name: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  message?: string | null;
  pagePath: string;
  /** "site" | "campanha" | "spam" | "newsletter" | "lista-de-espera" | "whatsapp" */
  source: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  ipHash: string | null;
  attribution: Record<string, unknown> | null;
  consentText?: string | null;
};

function originKeyFor(input: PublicLeadInput): "site" | "google_ads" | "meta_ads" {
  const a = input.attribution ?? {};
  if (a.gclid || a.gbraid || a.wbraid) return "google_ads";
  if (a.fbclid) return "meta_ads";
  return "site";
}

// Lead do formulário do site: vira conta + contato + negociação no CRM da organização, com
// a origem (UTM, clique de anúncio, página) e a base legal (a própria pessoa mandou os dados).
// Quem já existe (mesmo telefone ou e-mail) não vira conta duplicada: ganha um novo toque de
// origem e uma tarefa para o responsável. Spam é guardado só como evento, nunca vira lead.
export async function saveLead(input: PublicLeadInput): Promise<"saved" | "duplicate" | "spam"> {
  // Todo envio conta no limite (inclusive spam), pelo hash do IP.
  const event = await prismaAdmin.siteEvent
    .create({ data: { organizationId: input.organizationId, siteId: input.siteId, type: "FORM", path: input.pagePath, visitorHash: input.ipHash ?? "sem-ip", label: input.source === "spam" ? "spam" : "lead", utmSource: input.utmSource, utmMedium: input.utmMedium, utmCampaign: input.utmCampaign } })
    .catch((e) => { logError("sites: falha ao registrar envio do formulário", e, { siteId: input.siteId }); return null; });
  if (input.source === "spam") return "spam";
  // Grava primeiro e confere depois: uma rajada simultânea não passa do limite (ver leadOverLimit).
  if (event && (await leadOverLimit(input.siteId, input.ipHash).catch(() => false))) {
    await prismaAdmin.siteEvent.update({ where: { id: event.id }, data: { label: "limited" } }).catch(() => {});
    return "spam";
  }

  const ctx = { organizationId: input.organizationId, userId: null };
  const note = `Formulário do site ${input.host} em ${new Date().toISOString().slice(0, 10)}${input.consentText ? ` — ${input.consentText}` : ""}`.slice(0, 300);
  const details = [input.message, input.company ? `Empresa: ${input.company}` : null].filter(Boolean).join("\n");

  const result = await withOrgContext(input.organizationId, async (tx) => {
    const touch = {
      kind: "LANDING_PAGE" as const,
      channel: originKeyFor(input),
      landingPageId: input.siteId,
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign,
      gclid: typeof input.attribution?.gclid === "string" ? input.attribution.gclid : null,
      fbclid: typeof input.attribution?.fbclid === "string" ? input.attribution.fbclid : null,
      referrerHost: typeof input.attribution?.referrer === "string" ? input.attribution.referrer : null,
    };
    try {
      const lead = await createLead(tx, ctx, { name: input.name, company: input.company, phone: input.phone, email: input.email, message: input.message, originKey: touch.channel });
      // O primeiro toque criado pelo createLead ganha os detalhes (UTM, anúncio, página).
      await tx.origin.updateMany({ where: { organizationId: input.organizationId, accountId: lead.accountId, isFirstTouch: true }, data: { landingPageId: touch.landingPageId, utmSource: touch.utmSource, utmMedium: touch.utmMedium, utmCampaign: touch.utmCampaign, gclid: touch.gclid, fbclid: touch.fbclid, referrerHost: touch.referrerHost } });
      await tx.contact.updateMany({ where: { organizationId: input.organizationId, accountId: lead.accountId, isPrimary: true }, data: { legalBasis: input.consentText ? "CONSENT" : "LEGITIMATE_INTEREST", legalBasisNote: note } });
      // Primeira tarefa: atender agora, com o que a pessoa escreveu.
      await scheduleActivity(tx, ctx, { opportunityId: lead.opportunityId, type: "CALL", title: `Atender ${input.name} (veio do site)`, notes: details || null, dueAt: new Date() });
      return { kind: "saved" as const, opportunityId: lead.opportunityId };
    } catch (err) {
      if (!(err instanceof DuplicateLeadError) || !err.existingAccountId) throw err;
      await tx.origin.create({ data: { organizationId: input.organizationId, accountId: err.existingAccountId, contactId: err.existingContactId, ...touch, isFirstTouch: false } });
      const deal = await tx.opportunity.findFirst({ where: { accountId: err.existingAccountId, organizationId: input.organizationId, status: "OPEN" }, orderBy: { createdAt: "desc" }, select: { id: true } });
      if (deal) await scheduleActivity(tx, ctx, { opportunityId: deal.id, type: "CALL", title: `${input.name} entrou em contato de novo pelo site`, notes: details || null, dueAt: new Date() });
      return { kind: "duplicate" as const, opportunityId: deal?.id ?? null };
    }
  });

  await notifyOwners(input, result.opportunityId).catch((e) => logError("sites: falha ao avisar sobre o lead", e, { siteId: input.siteId }));
  return result.kind === "saved" ? "saved" : "duplicate";
}

// Aviso por e-mail aos donos e administradores: o lead precisa de resposta rápida.
async function notifyOwners(input: PublicLeadInput, opportunityId: string | null): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const members = await prismaAdmin.membership.findMany({ where: { organizationId: input.organizationId, role: { in: ["OWNER", "ADMIN"] } }, include: { user: { select: { email: true } } } });
  const to = [...new Set(members.map((m) => m.user.email).filter(Boolean))];
  if (to.length === 0) return;
  const link = opportunityId ? `${SITE_URL}/pipeline?abrir=${opportunityId}&owner=all` : `${SITE_URL}/leads`;
  const contact = [input.phone, input.email].filter(Boolean).join(" · ");
  const html = `<p>Novo contato pelo site <strong>${escapeHtml(input.host)}</strong>.</p><p><strong>${escapeHtml(input.name)}</strong>${input.company ? ` (${escapeHtml(input.company)})` : ""}<br>${escapeHtml(contact)}</p>${input.message ? `<p>${escapeHtml(input.message).replace(/\n/g, "<br>")}</p>` : ""}<p><a href="${link}">Abrir no Spinos e atender</a></p>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Spinos <noreply@spinos.com.br>", to, subject: `Novo contato pelo site: ${input.name}`, html }),
  });
}
