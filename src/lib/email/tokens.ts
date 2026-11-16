import { createHmac, timingSafeEqual } from "node:crypto";
import { SITE_URL } from "@/lib/site-url";

/*
 * Link de descadastro de campanha: organização + e-mail + assinatura HMAC, sem estado no banco.
 * O segredo é o mesmo dos e-mails de ciclo de vida (já existe em produção), com um prefixo próprio
 * para que um token de um uso nunca valha no outro.
 */

function secret(): string {
  const s = process.env.LIFECYCLE_EMAIL_SECRET;
  if (!s) throw new Error("LIFECYCLE_EMAIL_SECRET não configurado");
  return s;
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");
const sign = (organizationId: string, email: string) => createHmac("sha256", secret()).update(`mkt-unsub:${organizationId}:${email.toLowerCase()}`).digest("base64url");

export function unsubscribeUrl(organizationId: string, email: string): string {
  return `${SITE_URL}/descadastrar?o=${encodeURIComponent(organizationId)}&e=${b64(email.toLowerCase())}&t=${sign(organizationId, email)}`;
}

/** Devolve o e-mail se a assinatura confere; null se o link foi alterado. */
export function verifyUnsubscribe(organizationId: string | null, emailB64: string | null, token: string | null): string | null {
  if (!organizationId || !emailB64 || !token) return null;
  let email: string;
  try {
    email = unb64(emailB64).toLowerCase();
  } catch {
    return null;
  }
  if (!email.includes("@")) return null;
  const expected = Buffer.from(sign(organizationId, email));
  const actual = Buffer.from(token);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return email;
}

/** Endereço do descadastro de um clique (POST), usado no cabeçalho List-Unsubscribe. */
export function oneClickUnsubscribeUrl(organizationId: string, email: string): string {
  return `${SITE_URL}/api/email/unsubscribe?o=${encodeURIComponent(organizationId)}&e=${b64(email.toLowerCase())}&t=${sign(organizationId, email)}`;
}
