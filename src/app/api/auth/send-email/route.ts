import { Webhook } from "standardwebhooks";
import { SITE_URL } from "@/lib/site-url";
import { logError } from "@/lib/log-error";

type EmailActionType = "signup" | "recovery" | "invite" | "magiclink" | "email_change" | "reauthentication";

type EmailData = {
  token: string;
  token_hash: string;
  token_new?: string;
  token_hash_new?: string;
  redirect_to: string;
  email_action_type: EmailActionType;
};

type HookPayload = {
  user: { email: string };
  email_data: EmailData;
};

function buildEmailContent(actionType: EmailActionType, confirmUrl: string, recoveryCode?: string): { subject: string; html: string } {
  switch (actionType) {
    case "signup":
      return {
        subject: "Confirme seu e-mail — Spinos",
        html: `<p>Bem-vindo à Spinos! Clique no link abaixo pra confirmar seu e-mail e ativar sua conta:</p><p><a href="${confirmUrl}">Confirmar e-mail</a></p><p>Se você não pediu esse cadastro, pode ignorar este e-mail.</p>`,
      };
    case "recovery":
      // Código digitado, não link clicável — link clicável fica vulnerável
      // a scanner de segurança corporativo (Outlook/Gmail) que renderiza a
      // página e chega a simular o clique, queimando o token de uso único
      // antes da pessoa de verdade conseguir usar (caso real: Felipe/Sakatec,
      // 2026-08-09).
      return {
        subject: "Seu código de redefinição de senha — Spinos",
        html: `<p>Use o código abaixo pra criar uma senha nova:</p><p style="font-size:32px;font-weight:700;letter-spacing:6px;font-family:monospace;">${recoveryCode}</p><p>O código vale só por alguns minutos e uma única vez. Se você não pediu essa redefinição, pode ignorar este e-mail.</p>`,
      };
    case "email_change":
      return {
        subject: "Confirme a troca de e-mail — Spinos",
        html: `<p>Clique no link abaixo pra confirmar a troca de e-mail da sua conta Spinos:</p><p><a href="${confirmUrl}">Confirmar troca de e-mail</a></p><p>Se você não pediu essa troca, pode ignorar este e-mail.</p>`,
      };
    case "invite":
    case "magiclink":
    case "reauthentication":
    default:
      return {
        subject: "Seu link de acesso — Spinos",
        html: `<p>Clique no link abaixo pra acessar sua conta Spinos:</p><p><a href="${confirmUrl}">Acessar Spinos</a></p>`,
      };
  }
}

export async function POST(req: Request) {
  const hookSecret = process.env.SEND_EMAIL_HOOK_SECRET;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!hookSecret || !resendApiKey) {
    return Response.json({ error: "Hook não configurado (faltam variáveis de ambiente)." }, { status: 500 });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  let parsed: HookPayload;
  try {
    const wh = new Webhook(hookSecret.replace("v1,whsec_", ""));
    parsed = wh.verify(payload, headers) as HookPayload;
  } catch (err) {
    logError("send-email hook: assinatura inválida", err);
    return Response.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  const { user, email_data } = parsed;
  // Fluxo de troca de e-mail: com "Secure email change" desligado, só sai um
  // e-mail (pro endereço novo), e o Supabase usa os campos "_new" pra ele.
  const tokenHash =
    email_data.email_action_type === "email_change"
      ? email_data.token_hash_new || email_data.token_hash
      : email_data.token_hash;

  const next = email_data.redirect_to || "/";
  const confirmUrl = `${SITE_URL}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(email_data.email_action_type)}&next=${encodeURIComponent(next)}`;

  const { subject, html } = buildEmailContent(email_data.email_action_type, confirmUrl, email_data.token);

  const sendResult = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Spinos <noreply@spinos.com.br>", to: user.email, subject, html }),
  });

  if (!sendResult.ok) {
    const errorText = await sendResult.text();
    logError("send-email hook: Resend recusou o envio", errorText, { actionType: email_data.email_action_type });
    return Response.json({ error: `Falha ao enviar via Resend: ${errorText}` }, { status: 500 });
  }

  return Response.json({});
}
