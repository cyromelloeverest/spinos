import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Confere a assinatura de um webhook do Resend (padrão Svix): HMAC-SHA256 de "id.timestamp.corpo"
 * com o segredo "whsec_..." decodificado. Recusa mensagens com mais de 5 minutos (repetição).
 */
export function verifyResendWebhook(secret: string, headers: { id: string | null; timestamp: string | null; signature: string | null }, body: string, now: number = Date.now()): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return signature.split(" ").some((part) => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) return false;
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export type ResendEvent = { type: string; data?: { email_id?: string } };
export const SUPPRESS_EVENTS: Record<string, "BOUNCE" | "COMPLAINT"> = { "email.bounced": "BOUNCE", "email.complained": "COMPLAINT" };
