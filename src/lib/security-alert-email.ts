const SECURITY_ALERT_EMAIL = "contato@spinos.com.br";

// Mesmo mecanismo dos outros alertas internos (credit-alert-email.ts,
// privacy-email.ts) — Resend direto, sem depender de nenhuma fila. Nunca
// lança: um alerta que falha não pode derrubar o fluxo que o disparou.
async function sendAlert(subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Spinos <noreply@spinos.com.br>",
      to: SECURITY_ALERT_EMAIL,
      subject,
      html,
    }),
  }).catch(() => {});
}

export async function sendOrganizationDeletedAlert(input: { organizationName: string; organizationId: string }) {
  await sendAlert(
    `🗑️ Organização excluída: ${input.organizationName}`,
    `<p>A organização <strong>${input.organizationName}</strong> (${input.organizationId}) foi excluída permanentemente pelo painel administrador.</p>`,
  );
}

export async function sendMfaDisabledAlert(input: { actorEmail: string | null; actorUserId: string | null }) {
  await sendAlert(
    `🔓 MFA desativado${input.actorEmail ? ` — ${input.actorEmail}` : ""}`,
    `<p>Autenticação em duas etapas foi desativada${input.actorEmail ? ` para <strong>${input.actorEmail}</strong>` : ""}.</p>
<p>Se a pessoa não reconhece essa ação, a conta pode estar comprometida — vale confirmar diretamente com ela.</p>
<p>ID do usuário: ${input.actorUserId ?? "desconhecido"}</p>`,
  );
}

export async function sendBruteForceAlert(input: { ip: string; failedCount: number; windowMinutes: number }) {
  await sendAlert(
    `🚨 Possível força bruta de login — IP ${input.ip}`,
    `<p><strong>${input.failedCount} tentativas de login falhas</strong> vindas do IP <code>${input.ip}</code> nos últimos ${input.windowMinutes} minutos.</p>
<p>O rate limit já bloqueia esse IP automaticamente em 10 tentativas — esse alerta é só pra te dar visibilidade antes/durante, caso queira agir (bloquear o IP a nível de rede, avisar algum cliente, etc.).</p>`,
  );
}
