// Escapa texto de usuário antes de interpolar em template de e-mail HTML.
// Sem isso, um campo livre (nome de organização, nome de usuário) vira
// injeção de HTML num e-mail enviado com o domínio autenticado da Spinos —
// abusa da própria reputação de envio que SPF/DKIM/DMARC garantem.
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
