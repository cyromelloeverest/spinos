// Mesmo espírito do logSecurityEvent (src/lib/audit/log.ts), mas pra erros de
// aplicação em geral, não eventos de segurança. Não grava no banco de
// propósito — erro de aplicação é alto volume/baixo valor de auditoria
// comparado a evento de segurança; os logs da Vercel (console.*) já são o
// lugar certo pra isso. Nunca lança, só loga — assim um bloco de código que
// já está tratando uma falha (mostrando um fallback pro usuário) não corre
// risco de quebrar por causa do próprio log.
export function logError(context: string, err: unknown, metadata?: Record<string, unknown>): void {
  console.error(`[app-error] ${context}`, err, metadata ?? "");
}
