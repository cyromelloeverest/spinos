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

// Campo numérico opcional vindo de FormData (string crua, "" = não informado).
// Rejeita lixo tipo "abc"/"1e10"/"12.5" em vez de deixar virar NaN e estourar
// no INSERT/UPDATE do Prisma (Int) só lá na hora de gravar.
export function optionalIntSchema(label: string, min = 0, max = 1_000_000_000) {
  return z
    .string()
    .trim()
    .refine((v) => v === "" || /^-?\d+$/.test(v), { message: `${label} deve ser um número inteiro.` })
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (v >= min && v <= max), {
      message: `${label} deve estar entre ${min} e ${max}.`,
    });
}

// Texto livre opcional com teto de tamanho — a maioria desses campos (ICP,
// perfil da empresa) alimenta o prompt da busca por IA; sem teto, um valor
// gigante infla custo de tokens sem nenhum ganho real de qualidade.
export function optionalTextSchema(label: string, max: number) {
  return z
    .string()
    .trim()
    .max(max, `${label} muito longo (máximo ${max} caracteres).`)
    .transform((v) => v || null);
}

// Idem, mas para as listas separadas por vírgula (segments, states, keywords
// etc.) — limita tanto a quantidade de itens quanto o tamanho de cada um.
export function boundedListSchema(label: string, maxItems: number, maxItemLength = 120) {
  return z
    .array(z.string())
    .max(maxItems, `${label}: no máximo ${maxItems} itens.`)
    .refine((items) => items.every((i) => i.length <= maxItemLength), {
      message: `${label}: cada item deve ter no máximo ${maxItemLength} caracteres.`,
    });
}

export const optionalUrlSchema = z
  .string()
  .trim()
  .max(300, "Site muito longo.")
  .refine((v) => v === "" || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), {
    message: "Site inválido — use um endereço como https://suaempresa.com.br",
  })
  .transform((v) => v || null);
