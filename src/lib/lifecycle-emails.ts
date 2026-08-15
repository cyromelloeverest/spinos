import { createHmac, timingSafeEqual } from "node:crypto";
import { SITE_URL } from "@/lib/site-url";
import { escapeHtml } from "@/lib/html-escape";

const DAY_MS = 24 * 60 * 60 * 1000;

// Janelas/tetos de cada gatilho (brief 2026-08-14) — ajustáveis aqui sem
// mexer no resto da lógica.
export const TRIAL_NO_SEARCH_AFTER_DAYS = 2;
export const TRIAL_ENDING_WITHIN_DAYS = 2;
export const STALE_OPPORTUNITIES_AFTER_DAYS = 5;
export const STALE_OPPORTUNITIES_MIN_COUNT = 3;
export const STALE_OPPORTUNITIES_RESEND_COOLDOWN_DAYS = 7;

type OrgLifecycleState = {
  createdAt: Date;
  trialEndsAt: Date | null;
  lifecycleEmailsOptOut: boolean;
  trialNoSearchEmailSentAt: Date | null;
  trialEndingEmailSentAt: Date | null;
  staleOpportunitiesEmailSentAt: Date | null;
};

// Funções puras de elegibilidade, separadas do envio/DB de propósito —
// testáveis sem mock de Prisma nem de rede. O cron (src/app/api/cron/
// lifecycle-emails/route.ts) busca os dados e só chama essas funções.

export function shouldSendTrialNoSearchEmail(
  org: Pick<OrgLifecycleState, "createdAt" | "trialEndsAt" | "lifecycleEmailsOptOut" | "trialNoSearchEmailSentAt">,
  searchRunCount: number,
  now: Date = new Date(),
): boolean {
  if (org.lifecycleEmailsOptOut) return false;
  if (org.trialNoSearchEmailSentAt) return false;
  if (!org.trialEndsAt || org.trialEndsAt.getTime() <= now.getTime()) return false; // só trial ainda ativo
  if (searchRunCount > 0) return false;
  const daysSinceCreated = (now.getTime() - org.createdAt.getTime()) / DAY_MS;
  return daysSinceCreated >= TRIAL_NO_SEARCH_AFTER_DAYS;
}

export function shouldSendTrialEndingEmail(
  org: Pick<OrgLifecycleState, "trialEndsAt" | "lifecycleEmailsOptOut" | "trialEndingEmailSentAt">,
  now: Date = new Date(),
): boolean {
  if (org.lifecycleEmailsOptOut) return false;
  if (org.trialEndingEmailSentAt) return false;
  if (!org.trialEndsAt) return false;
  const msUntilEnd = org.trialEndsAt.getTime() - now.getTime();
  if (msUntilEnd <= 0) return false; // trial já acabou, isso vira outro fluxo (não este)
  return msUntilEnd <= TRIAL_ENDING_WITHIN_DAYS * DAY_MS;
}

export function shouldSendStaleOpportunitiesEmail(
  org: Pick<OrgLifecycleState, "lifecycleEmailsOptOut" | "staleOpportunitiesEmailSentAt">,
  staleActiveCount: number,
  now: Date = new Date(),
): boolean {
  if (org.lifecycleEmailsOptOut) return false;
  if (staleActiveCount < STALE_OPPORTUNITIES_MIN_COUNT) return false;
  if (org.staleOpportunitiesEmailSentAt) {
    const daysSinceSent = (now.getTime() - org.staleOpportunitiesEmailSentAt.getTime()) / DAY_MS;
    if (daysSinceSent < STALE_OPPORTUNITIES_RESEND_COOLDOWN_DAYS) return false;
  }
  return true;
}

// Token de descadastro: HMAC determinístico em vez de coluna nova no banco
// (evita backfill pra organizações já existentes) — verificável sem estado,
// só com LIFECYCLE_EMAIL_SECRET.
function unsubscribeToken(organizationId: string): string {
  const secret = process.env.LIFECYCLE_EMAIL_SECRET;
  if (!secret) throw new Error("LIFECYCLE_EMAIL_SECRET não configurado");
  return createHmac("sha256", secret).update(organizationId).digest("hex");
}

export function buildUnsubscribeUrl(organizationId: string): string {
  const token = unsubscribeToken(organizationId);
  return `${SITE_URL}/api/lifecycle-emails/unsubscribe?org=${encodeURIComponent(organizationId)}&token=${token}`;
}

export function verifyUnsubscribeToken(organizationId: string, token: string): boolean {
  if (!process.env.LIFECYCLE_EMAIL_SECRET) return false;
  const expected = Buffer.from(unsubscribeToken(organizationId));
  const actual = Buffer.from(token);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

function unsubscribeFooter(organizationId: string): string {
  return `<p style="color:#9ca3af;font-size:12px;margin-top:24px;">Não quer mais receber esses lembretes? <a href="${buildUnsubscribeUrl(organizationId)}">Descadastrar</a>. Isso não afeta e-mails da sua conta (redefinição de senha, convites, recibos).</p>`;
}

async function sendResendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // sem chave configurada — não derruba o cron, só não dispara
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Spinos <noreply@spinos.com.br>", to, subject, html }),
  });
}

function greeting(name: string | null): string {
  return name ? `Oi ${escapeHtml(name)},` : "Oi,";
}

export async function sendTrialNoSearchEmail(input: {
  organizationId: string;
  to: string;
  name: string | null;
  trialEndsAt: Date;
}): Promise<void> {
  const dataFim = input.trialEndsAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
  const link = `${SITE_URL}/oportunidades`;
  const html = `<p>${greeting(input.name)}</p>
<p>Você ainda não usou a busca grátis do seu teste na Spinos. É rápido: a IA vasculha sinais públicos reais (notícias, vagas, editais, expansões) e te mostra empresas com alta chance de fechar negócio com você agora — score, motivo e abordagem prontos.</p>
<p><a href="${link}">Rodar minha busca grátis</a></p>
<p>Seu teste vai até ${dataFim}.</p>
${unsubscribeFooter(input.organizationId)}`;
  await sendResendEmail(input.to, "Sua busca grátis na Spinos ainda está esperando", html);
}

export async function sendTrialEndingEmail(input: {
  organizationId: string;
  to: string;
  name: string | null;
  trialEndsAt: Date;
  daysRemaining: number;
  opportunitiesCount: number;
}): Promise<void> {
  const dataFim = input.trialEndsAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
  const dias = input.daysRemaining === 1 ? "1 dia" : `${input.daysRemaining} dias`;
  const opportunitiesLine =
    input.opportunitiesCount > 0
      ? `<p>Você já tem ${input.opportunitiesCount} oportunidade${input.opportunitiesCount === 1 ? "" : "s"} encontrada${input.opportunitiesCount === 1 ? "" : "s"} — não perca o que já foi levantado.</p>`
      : "";
  const link = `${SITE_URL}/settings/empresa`;
  const html = `<p>${greeting(input.name)}</p>
<p>Seu teste grátis termina em ${dias} (${dataFim}). Depois disso, o acesso à Spinos fica bloqueado até você assinar um plano.</p>
${opportunitiesLine}
<p><a href="${link}">Ver planos e continuar</a></p>
${unsubscribeFooter(input.organizationId)}`;
  await sendResendEmail(input.to, `Seu teste grátis na Spinos termina em ${dias}`, html);
}

export async function sendStaleOpportunitiesEmail(input: {
  organizationId: string;
  to: string;
  name: string | null;
  opportunitiesCount: number;
  daysStale: number;
}): Promise<void> {
  const link = `${SITE_URL}/oportunidades`;
  const html = `<p>${greeting(input.name)}</p>
<p>A Spinos encontrou ${input.opportunitiesCount} oportunidades pro seu ICP que ainda estão paradas — nenhuma foi movida pro pipeline ou descartada nos últimos ${input.daysStale} dias.</p>
<p><a href="${link}">Ver minhas oportunidades</a></p>
${unsubscribeFooter(input.organizationId)}`;
  await sendResendEmail(input.to, `Você tem ${input.opportunitiesCount} oportunidades esperando uma ação na Spinos`, html);
}
