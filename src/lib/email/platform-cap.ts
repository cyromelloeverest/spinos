import { prismaAdmin } from "@/lib/prisma-admin";
import { dayStartBrt } from "./campaign";

/*
 * Teto da CONTA de envio (todas as organizações juntas). O provedor limita a conta inteira: no plano gratuito do
 * Resend são 100 e-mails por dia e 3.000 por mês, e os e-mails do sistema (login, convite, alertas) usam a mesma
 * cota. Por isso as campanhas ficam abaixo disso, com folga. Ao assinar um plano pago do provedor, suba os dois
 * valores nas variáveis de ambiente EMAIL_PLATFORM_DAILY_CAP e EMAIL_PLATFORM_MONTHLY_CAP.
 */
export const PLATFORM_DAILY_CAP_DEFAULT = 60;
export const PLATFORM_MONTHLY_CAP_DEFAULT = 2000;

function envInt(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Quantos e-mails de campanha ainda cabem hoje e neste mês na conta de envio. */
export async function platformEmailBudget(now: Date = new Date()): Promise<number> {
  const dayStart = dayStartBrt(now);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const used = { status: { in: ["SENT", "SENDING", "BOUNCED", "COMPLAINED"] as ("SENT" | "SENDING" | "BOUNCED" | "COMPLAINED")[] } };
  const [today, month] = await Promise.all([
    prismaAdmin.emailMessage.count({ where: { ...used, OR: [{ sentAt: { gte: dayStart } }, { claimedAt: { gte: dayStart } }] } }),
    prismaAdmin.emailMessage.count({ where: { ...used, OR: [{ sentAt: { gte: monthStart } }, { claimedAt: { gte: monthStart } }] } }),
  ]);
  return Math.max(0, Math.min(envInt("EMAIL_PLATFORM_DAILY_CAP", PLATFORM_DAILY_CAP_DEFAULT) - today, envInt("EMAIL_PLATFORM_MONTHLY_CAP", PLATFORM_MONTHLY_CAP_DEFAULT) - month));
}
