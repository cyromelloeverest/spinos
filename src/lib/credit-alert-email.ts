const SALES_ALERT_EMAIL = "contato@spinos.com.br";

// Uma organização ainda em trial pagando por saldo extra antes mesmo de virar
// cliente é o sinal de lead mais quente que existe — dispara um alerta
// interno na hora (mesmo mecanismo do aviso de pedido de exclusão LGPD em
// src/lib/privacy-email.ts).
export async function sendTrialCreditPurchaseAlert(input: {
  organizationName: string;
  organizationId: string;
  quantity: number;
  amountBRL: number;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // sem chave configurada — não derruba o webhook, só não dispara o alerta

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Spinos <noreply@spinos.com.br>",
      to: SALES_ALERT_EMAIL,
      subject: `🔥 Lead quente: ${input.organizationName} comprou saldo extra ainda em trial`,
      html: `<p><strong>${input.organizationName}</strong> comprou ${input.quantity} buscas extras (R$${input.amountBRL}) antes de converter pra um plano pago.</p>
<p>Isso é um sinal forte de intenção real — vale contato comercial proativo.</p>
<p>ID da organização: ${input.organizationId}</p>`,
    }),
  });
}
