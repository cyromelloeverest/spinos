import { z } from "zod";

// Schemas compartilhados pras server actions que recebem FormData de
// usuário. Uso pretendido: validar depois do trim()/toLowerCase() manual que
// as actions já fazem, não substituir esse tratamento.
export const emailSchema = z.string().trim().toLowerCase().min(1, "Informe um e-mail.").email("E-mail inválido.").max(254);

// 8 é o mínimo que updatePassword() já exigia antes desta mudança — signUp()
// não tinha nenhuma validação server-side, só o minLength=6 do HTML (que não
// protege nada, é só UX). Unificado nos dois pra não ter uma senha "válida"
// no cadastro que o app rejeitaria depois na troca de senha.
export const passwordSchema = z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(200);

export function firstIssueMessage(error: z.ZodError, fallback = "Dados inválidos."): string {
  return error.issues[0]?.message ?? fallback;
}
