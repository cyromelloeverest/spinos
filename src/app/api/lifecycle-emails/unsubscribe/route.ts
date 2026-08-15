import { prismaAdmin } from "@/lib/prisma-admin";
import { verifyUnsubscribeToken } from "@/lib/lifecycle-emails";
import { logError } from "@/lib/log-error";

function htmlPage(title: string, body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title} — Spinos</title></head><body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#111827;"><h1 style="font-size:20px;">${title}</h1><p style="color:#6b7280;">${body}</p></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

// Sem sessão de propósito — precisa funcionar a partir de um clique direto
// no e-mail, de qualquer dispositivo, sem exigir login. Segurança vem do
// token HMAC (ver verifyUnsubscribeToken em lifecycle-emails.ts), não de
// autenticação.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("org");
  const token = url.searchParams.get("token");

  if (!organizationId || !token || !verifyUnsubscribeToken(organizationId, token)) {
    return htmlPage("Link inválido", "Esse link de descadastro não é válido ou já expirou.", 400);
  }

  try {
    await prismaAdmin.organization.update({
      where: { id: organizationId },
      data: { lifecycleEmailsOptOut: true },
    });
  } catch (err) {
    logError("lifecycle-emails/unsubscribe: falha ao descadastrar", err, { organizationId });
    return htmlPage("Não foi possível agora", "Tente novamente em alguns instantes.", 500);
  }

  return htmlPage(
    "Você não vai mais receber esses lembretes",
    "Pode reativar a qualquer momento em Configurações. Isso não afeta e-mails da sua conta, como redefinição de senha ou convites.",
  );
}
