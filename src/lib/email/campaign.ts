import type { Prisma } from "@/generated/prisma/client";
import { getPlan } from "@/lib/plans";
import { withOrgContext } from "@/lib/db/with-org-context";
import { logError } from "@/lib/log-error";
import { runChecks, buildSignature } from "@/lib/content/checks";
import { packForKey } from "@/lib/content/generate";
import { AUDIENCES, isAudienceKey, resolveAudience } from "./audience";
import { renderCampaignHtml, renderCampaignText } from "./render";
import { safeDisplayName, type EmailProvider } from "./provider";
import { oneClickUnsubscribeUrl, unsubscribeUrl } from "./tokens";

type Tx = Prisma.TransactionClient;

export const MAX_RECIPIENTS_PER_CAMPAIGN = 2000;
export const BATCH_SIZE = 40;
// Aquecimento do envio: nos primeiros 30 dias depois do primeiro e-mail da organização o teto diário é baixo
// (domínio novo para o remetente: pico de volume logo no início é o que mais derruba reputação).
export const EMAIL_WARMUP_DAYS = 30;
export const EMAIL_WARMUP_DAILY = 100;

/** Teto de e-mails por dia: o do plano, limitado ao do aquecimento enquanto a organização é nova no envio. */
export function dailyEmailCap(plan: string, firstSentAt: Date | null, now: Date = new Date()): number {
  const planCap = getPlan(plan as never).maxEmailsPerDay;
  if (!firstSentAt) return Math.min(planCap, EMAIL_WARMUP_DAILY);
  const days = (now.getTime() - firstSentAt.getTime()) / 86400000;
  return days < EMAIL_WARMUP_DAYS ? Math.min(planCap, EMAIL_WARMUP_DAILY) : planCap;
}

/** Início do dia em Brasília (UTC-3, sem horário de verão), em UTC. */
function dayStartBrt(now: Date): Date {
  const shifted = new Date(now.getTime() - 3 * 3600_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), 3));
}

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
  // Uma liberação por vez por organização: sem isso, duas campanhas liberadas juntas leem o mesmo uso do mês e furam o teto.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
  const campaign = await tx.emailCampaign.findFirst({ where: { id: campaignId, organizationId } });
  if (!campaign) throw new CampaignError("Campanha não encontrada.");
  if (campaign.status !== "DRAFT") throw new CampaignError("Esta campanha já foi enviada.");
  const input = clean({ name: campaign.name, subject: campaign.subject, preheader: campaign.preheader, body: campaign.body, audience: campaign.audience });

  const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const health = await deliverabilityStatus(tx, organizationId, now);
  if (health.paused) throw new CampaignError(`O envio da sua conta está pausado por ${health.reason}. Fale com o suporte do Spinos para liberar.`);
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

/**
 * Freio de reputação: o domínio de envio é compartilhado entre clientes, então uma organização com
 * muitos endereços inexistentes ou muitas reclamações de spam pausa o envio de TODAS as suas campanhas
 * até a equipe do Spinos olhar. Limites na linha do que Gmail e Yahoo toleram.
 */
export async function deliverabilityStatus(tx: Tx, organizationId: string, now: Date = new Date()): Promise<{ paused: boolean; reason: string | null }> {
  const since = new Date(now.getTime() - 30 * 86400000);
  const rows = await tx.emailMessage.groupBy({ by: ["status"], where: { organizationId, sentAt: { gte: since }, status: { in: ["SENT", "BOUNCED", "COMPLAINED"] } }, _count: { _all: true } });
  const n = (s: string) => rows.find((r) => r.status === s)?._count._all ?? 0;
  const bounced = n("BOUNCED");
  const complained = n("COMPLAINED");
  const total = n("SENT") + bounced + complained;
  if (complained >= 3 && complained / total >= 0.003) return { paused: true, reason: "reclamações de spam acima do tolerado" };
  if (total >= 50 && bounced >= 5 && bounced / total >= 0.05) return { paused: true, reason: "muitos endereços que não existem" };
  return { paused: false, reason: null };
}

/** Quanto tempo uma mensagem reservada pode ficar "em envio" antes de voltar para a fila (rodada que caiu no meio). */
const CLAIM_TTL_MS = 10 * 60_000;

type Runner = <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>;

/**
 * Envia um lote da fila de uma organização, SEM segurar transação durante as chamadas de rede:
 *   1. transação curta: confere o freio, devolve à fila reservas velhas e RESERVA o lote (SKIP LOCKED,
 *      então rodadas sobrepostas nunca pegam a mesma mensagem);
 *   2. fora de transação: envia cada mensagem (a chave de idempotência do provedor torna uma repetição segura);
 *   3. uma transação curta por mensagem registra o resultado; no fim, fecha as campanhas sem pendências.
 * `run` abre o contexto da organização (nos testes, o do papel restrito).
 */
export async function processOrganizationQueue(organizationId: string, provider: EmailProvider, run: Runner = (fn) => withOrgContext(organizationId, fn), now: Date = new Date()) {
  if (process.env.EMAIL_SENDING_DISABLED === "1") return { sent: 0, failed: 0, paused: true };

  const plan = await run(async (tx) => {
    if ((await deliverabilityStatus(tx, organizationId, now)).paused) return null;
    await tx.emailMessage.updateMany({ where: { organizationId, status: "SENDING", claimedAt: { lt: new Date(now.getTime() - CLAIM_TTL_MS) } }, data: { status: "QUEUED", claimedAt: null } });
    const campaigns = await tx.emailCampaign.findMany({ where: { organizationId, status: "SENDING" }, orderBy: { startedAt: "asc" } });
    const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } });
    const { lines } = await senderInfo(tx, organizationId);
    // Teto do dia: o que passar dele continua na fila e sai nos dias seguintes (a campanha segue "enviando").
    const dayStart = dayStartBrt(now);
    const today = await tx.emailMessage.count({ where: { organizationId, status: { in: ["SENT", "SENDING", "BOUNCED", "COMPLAINED"] }, OR: [{ sentAt: { gte: dayStart } }, { claimedAt: { gte: dayStart } }] } });
    const firstSentAt = (await tx.emailMessage.aggregate({ where: { organizationId, sentAt: { not: null } }, _min: { sentAt: true } }))._min.sentAt;
    let budget = Math.min(BATCH_SIZE, dailyEmailCap(org.plan, firstSentAt, now) - today);
    const claimed: { campaign: (typeof campaigns)[number]; id: string; email: string; firstName: string | null; replyTo: string | null }[] = [];
    for (const campaign of campaigns) {
      if (budget <= 0) break;
      // As respostas vão para quem liberou o envio.
      const replyTo = campaign.startedByUserId ? (await tx.membership.findFirst({ where: { organizationId, userId: campaign.startedByUserId }, select: { user: { select: { email: true } } } }))?.user.email ?? null : null;
      const ids = (await tx.emailMessage.findMany({ where: { campaignId: campaign.id, organizationId, status: "QUEUED" }, orderBy: { createdAt: "asc" }, take: budget, select: { id: true } })).map((r) => r.id);
      // O UPDATE só pega quem AINDA está na fila: se outra rodada reservou no meio, essas linhas voltam vazias.
      const rows = ids.length === 0 ? [] : await tx.$queryRaw<{ id: string; email: string; firstName: string | null }[]>`
        UPDATE email_messages SET status = 'SENDING', "claimedAt" = ${now}
        WHERE id = ANY(${ids}) AND "organizationId" = ${organizationId} AND status = 'QUEUED'
        RETURNING id, email, "firstName"`;
      budget -= rows.length;
      for (const r of rows) claimed.push({ campaign, ...r, replyTo });
    }
    return { org, lines, claimed, campaignIds: campaigns.map((c) => c.id) };
  });
  if (!plan) return { sent: 0, failed: 0, paused: true };

  const from = `${safeDisplayName(plan.org.name)} <envio@spinos.com.br>`;
  let sent = 0;
  let failed = 0;
  for (const m of plan.claimed) {
    // Reconfere a supressão na hora de enviar: alguém pode ter se descadastrado depois de a campanha ser liberada.
    const suppressed = await run((tx) => tx.emailSuppression.findUnique({ where: { organizationId_email: { organizationId, email: m.email } } }));
    if (suppressed) {
      await run((tx) => tx.emailMessage.update({ where: { id: m.id }, data: { status: "FAILED", error: "Descadastrado" } }));
      failed += 1;
      continue;
    }
    let providerId: string;
    try {
      const render = { subject: m.campaign.subject, preheader: m.campaign.preheader, body: m.campaign.body, firstName: m.firstName, senderName: plan.org.name, senderLines: plan.lines, unsubscribeUrl: unsubscribeUrl(organizationId, m.email) };
      const res = await provider.send({
        from,
        to: m.email,
        replyTo: m.replyTo,
        subject: m.campaign.subject,
        html: renderCampaignHtml(render),
        text: renderCampaignText(render),
        headers: { "List-Unsubscribe": `<${oneClickUnsubscribeUrl(organizationId, m.email)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        idempotencyKey: m.id,
      });
      providerId = res.id;
    } catch (err) {
      await run((tx) => tx.emailMessage.update({ where: { id: m.id }, data: { status: "FAILED", error: String((err as Error).message).slice(0, 200), claimedAt: null } }));
      failed += 1;
      continue;
    }
    // O e-mail JÁ SAIU. Se só o registro falhar, a mensagem fica reservada (nunca "falhou"): passado o prazo
    // ela volta à fila e o reenvio, com a mesma chave de idempotência, é descartado pelo provedor.
    sent += 1;
    await run((tx) => tx.emailMessage.update({ where: { id: m.id }, data: { status: "SENT", providerId, sentAt: new Date(), claimedAt: null } })).catch((e) => logError("email: envio feito, registro falhou", e, { organizationId, messageId: m.id }));
  }

  await run(async (tx) => {
    for (const id of plan.campaignIds) {
      const left = await tx.emailMessage.count({ where: { campaignId: id, organizationId, status: { in: ["QUEUED", "SENDING"] } } });
      if (left === 0) await tx.emailCampaign.updateMany({ where: { id, organizationId, status: "SENDING" }, data: { status: "SENT", finishedAt: new Date() } });
    }
  });
  return { sent, failed, paused: false };
}

export { AUDIENCES };
export { resolveAudience };
