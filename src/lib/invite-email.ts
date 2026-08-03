import { SITE_URL } from "@/lib/site-url";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function sendInviteEmail(to: string, orgName: string, token: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // sem chave configurada, o convite ainda fica salvo — só não dispara e-mail

  const link = `${SITE_URL}/convite/${token}`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Spinos <noreply@spinos.com.br>",
      to,
      subject: `Você foi convidado para a ${orgName} na Spinos`,
      html: `<p>Você foi convidado para participar da organização <strong>${orgName}</strong> na Spinos.</p><p><a href="${link}">Clique aqui para aceitar o convite</a></p><p>Esse link expira em 7 dias.</p>`,
    }),
  });
}
