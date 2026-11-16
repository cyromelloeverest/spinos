import type { Prisma } from "@/generated/prisma/client";
import { getPlan } from "@/lib/plans";
import { runChecks, buildSignature } from "@/lib/content/checks";
import { packForKey } from "@/lib/content/generate";
import { AUDIENCES, isAudienceKey, resolveAudience } from "./audience";
import { renderCampaignHtml, renderCampaignText } from "./render";
import { safeDisplayName, type EmailProvider } from "./provider";
import { oneClickUnsubscribeUrl, unsubscribeUrl } from "./tokens";

type Tx = Prisma.TransactionClient;

export const MAX_RECIPIENTS_PER_CAMPAIGN = 2000;
export const BATCH_SIZE = 40;

export class CampaignError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignError";
  }
}

export type CampaignInput = { name: string; subject: string; preheader?: string | null; body: string; audience: string };

function clean(input: CampaignInput) {
  const name = input.name.trim().slice(0, 120);
  const subject = input.subject.trim().replace(/[\r\n]+/g, " ").slice(0, 120);
  const body = input.body.trim().slice(0, 20000);
  if (!name) throw new CampaignError("Dê um nome à campanha (só você vê).");
  if (!subject) throw new CampaignError("Escreva o assunto do e-mail.");
  if (body.length < 20) throw new CampaignError("O texto do e-mail está curto demais.");
  if (!isAudienceKey(input.audience)) throw new CampaignError("Escolha para quem enviar.");
  return { name, subject, body, preheader: input.preheader?.trim().slice(0, 140) || null, audience: input.audience };
}

export async function saveCampaign(tx: Tx, organizationId: string, userId: string | null, id: string | null, input: CampaignInput) {
  const data = clean(input);
  if (!id) return tx.emailCampaign.create({ data: { organizationId, createdByUserId: userId, ...data } });
  const res = await tx.emailCampaign.updateMany({ where: { id, organizationId, status: "DRAFT" }, data });
  if (res.count === 0) throw new CampaignError("Esta campanha já foi enviada e não pode mais ser editada.");
  return tx.emailCampaign.findFirstOrThrow({ where: { id, organizationId } });
}

/** Linhas de identificação do remetente no rodapé (obrigatórias para o destinatário saber quem escreve). */
async function senderInfo(tx: Tx, organizationId: string) {
  const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const installed = await tx.organizationPack.findUnique({ where: { organizationId }, select: { packKey: true } });
  const pack = packForKey(installed?.packKey);
  const signature = buildSignature(pack, org);
  const place = [org.city, org.state].filter(Boolean).join("/");
  const lines = [org.name, [org.cnpj ? `CNPJ ${org.cnpj}` : "", place].filter(Boolean).join(" · "), signature && !signature.warning ? signature.text : ""].filter(Boolean);
  return { org, pack, lines, signatureMissing: Boolean(signature?.warning) };
}

/** O que a pessoa precisa ver antes de enviar: quantos recebem, quem ficou de fora e avisos do segmento. */
export async function previewCampaign(tx: Tx, organizationId: string, campaignId: string) {
  const campaign = await tx.emailCampaign.findFirstOrThrow({ where: { id: campaignId, organizationId } });
  const audience = isAudienceKey(campaign.audience) ? await resolveAudience(tx, organizationId, campaign.audience) : { recipients: [], excluded: { semEmail: 0, semBaseLegal: 0, descadastrados: 0 } };
  const { pack, signatureMissing } = await senderInfo(tx, organizationId);
  const warnings = runChecks(pack, `${campaign.subject}\n${campaign.body}`);
  if (signatureMissing) warnings.push("Falta o responsável técnico e o registro profissional no Perfil da empresa: a assinatura do rodapé é obrigatória na divulgação do seu segmento.");
  return { campaign, recipients: audience.recipients.length, excluded: audience.excluded, warnings, signatureMissing };
}

/**
 * Libera o envio: confere plano, teto do mês e público, congela o HTML e enfileira um registro por
 * destinatário. Quem de fato envia é a rotina de fila (processQueue), em lotes.
 */
export async function startCampaign(tx: Tx, ctx: { organizationId: string; userId: string | null }, campaignId: string, now: Date = new Date()) {
  if (process.env.EMAIL_SENDING_DISABLED === "1") throw new CampaignError("O envio de campanhas está pausado pela equipe do Spinos. Tente mais tarde.");
  const { organizationId } = ctx;
  const campaign = await tx.emailCampaign.findFirst({ where: { id: campaignId, organizationId } });
  if (!campaign) throw new CampaignError("Campanha não encontrada.");
  if (campaign.status !== "DRAFT") throw new CampaignError("Esta campanha já foi enviada.");
  const input = clean({ name: campaign.name, subject: campaign.subject, preheader: campaign.preheader, body: campaign.body, audience: campaign.audience });

  const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } });
  if (org.trialEndsAt !== null) throw new CampaignError("Campanhas para contatos reais ficam disponíveis depois da assinatura. No teste, use o envio de teste para você.");
  const cap = getPlan(org.plan).maxEmailsPerMonth;
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const sentThisMonth = await tx.emailMessage.count({ where: { organizationId, createdAt: { gte: monthStart }, status: { not: "FAILED" } } });

  const { recipients } = await resolveAudience(tx, organizationId, input.audience as never);
  if (recipients.length === 0) throw new CampaignError("Nenhum contato apto neste público: é preciso e-mail e base legal de consentimento ou contrato registrada.");
  if (recipients.length > MAX_RECIPIENTS_PER_CAMPAIGN) throw new CampaignError(`Cada campanha envia para até ${MAX_RECIPIENTS_PER_CAMPAIGN} contatos. Este público tem ${recipients.length}.`);
  if (sentThisMonth + recipients.length > cap) throw new CampaignError(`Seu plano inclui ${cap} e-mails por mês e ${sentThisMonth} já foram usados. Esta campanha precisa de ${recipients.length}.`);

  const { lines } = await senderInfo(tx, organizationId);
  // Fotografia do HTML para registro (com o nome e o link de exemplo): cada envio personaliza nome e link.
  const htmlSnapshot = renderCampaignHtml({ subject: input.subject, preheader: input.preheader, body: input.body, firstName: null, senderName: org.name, senderLines: lines, unsubscribeUrl: "https://app.spinos.com.br/descadastrar" });
  await tx.emailMessage.createMany({ data: recipients.map((r) => ({ organizationId, campaignId, contactId: r.contactId, email: r.email, firstName: r.firstName })), skipDuplicates: true });
  await tx.emailCampaign.update({ where: { id: campaignId }, data: { status: "SENDING", startedAt: now, startedByUserId: ctx.userId, totalRecipients: recipients.length, htmlSnapshot } });
  return { recipients: recipients.length };
}

export async function cancelCampaign(tx: Tx, organizationId: string, campaignId: string) {
  const c = await tx.emailCampaign.findFirst({ where: { id: campaignId, organizationId } });
  if (!c || c.status !== "SENDING") throw new CampaignError("Só dá para cancelar uma campanha que está sendo enviada.");
  await tx.emailMessage.updateMany({ where: { campaignId, organizationId, status: "QUEUED" }, data: { status: "FAILED", error: "Campanha cancelada" } });
  await tx.emailCampaign.update({ where: { id: campaignId }, data: { status: "CANCELED", finishedAt: new Date() } });
}

/** Envia um lote da fila de uma organização. Idempotente: o que já saiu não volta para a fila. */
export async function processOrganizationQueue(tx: Tx, organizationId: string, provider: EmailProvider) {
  if (process.env.EMAIL_SENDING_DISABLED === "1") return { sent: 0, failed: 0, paused: true };
  const campaigns = await tx.emailCampaign.findMany({ where: { organizationId, status: "SENDING" }, orderBy: { startedAt: "asc" } });
  let sent = 0;
  let failed = 0;
  let budget = BATCH_SIZE;
  const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const { lines } = await senderInfo(tx, organizationId);
  const from = `${safeDisplayName(org.name)} <envio@spinos.com.br>`;
  for (const campaign of campaigns) {
    if (budget <= 0) break;
    // As respostas vão para quem liberou o envio.
    const replyTo = campaign.startedByUserId ? (await tx.membership.findFirst({ where: { organizationId, userId: campaign.startedByUserId }, select: { user: { select: { email: true } } } }))?.user.email ?? null : null;
    const batch = await tx.emailMessage.findMany({ where: { campaignId: campaign.id, organizationId, status: "QUEUED" }, take: budget, orderBy: { createdAt: "asc" } });
    for (const m of batch) {
      budget -= 1;
      // Reconfere a supressão na hora de enviar: alguém pode ter se descadastrado depois de a campanha ser liberada.
      if (await tx.emailSuppression.findUnique({ where: { organizationId_email: { organizationId, email: m.email } } })) {
        await tx.emailMessage.update({ where: { id: m.id }, data: { status: "FAILED", error: "Descadastrado" } });
        failed += 1;
        continue;
      }
      try {
        const unsub = unsubscribeUrl(organizationId, m.email);
        const render = { subject: campaign.subject, preheader: campaign.preheader, body: campaign.body, firstName: m.firstName, senderName: org.name, senderLines: lines, unsubscribeUrl: unsub };
        const res = await provider.send({
          from,
          to: m.email,
          replyTo,
          subject: campaign.subject,
          html: renderCampaignHtml(render),
          text: renderCampaignText(render),
          headers: { "List-Unsubscribe": `<${oneClickUnsubscribeUrl(organizationId, m.email)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        });
        await tx.emailMessage.update({ where: { id: m.id }, data: { status: "SENT", providerId: res.id, sentAt: new Date() } });
        sent += 1;
      } catch (err) {
        await tx.emailMessage.update({ where: { id: m.id }, data: { status: "FAILED", error: String((err as Error).message).slice(0, 200) } });
        failed += 1;
      }
    }
    const left = await tx.emailMessage.count({ where: { campaignId: campaign.id, organizationId, status: "QUEUED" } });
    if (left === 0) await tx.emailCampaign.update({ where: { id: campaign.id }, data: { status: "SENT", finishedAt: new Date() } });
  }
  return { sent, failed, paused: false };
}

export { AUDIENCES };
export { resolveAudience };
