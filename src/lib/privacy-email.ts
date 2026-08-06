const PRIVACY_CONTACT_EMAIL = "contato@spinos.com.br";

export async function sendDeletionRequestEmail(input: {
  organizationName: string;
  organizationId: string;
  requesterName: string | null;
  requesterEmail: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // sem chave configurada — o pedido ainda fica registrado no log de auditoria, só não dispara e-mail

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Spinos <noreply@spinos.com.br>",
      to: PRIVACY_CONTACT_EMAIL,
      subject: `Solicitação de exclusão de conta — ${input.organizationName}`,
      html: `<p>Uma solicitação de exclusão de conta (LGPD, art. 18) foi registrada.</p>
<ul>
<li><strong>Organização:</strong> ${input.organizationName} (${input.organizationId})</li>
<li><strong>Solicitado por:</strong> ${input.requesterName ?? "—"} — ${input.requesterEmail}</li>
</ul>
<p>Revise e, se procedente, confirme a exclusão no painel administrador (/admin).</p>`,
    }),
  });
}
