import { z } from "zod";

// Cada informação extraída do edital carrega de onde veio. "fato" = o texto
// do edital diz isso; "interpretacao" = inferência da IA a partir do texto.
// Sem fonte verificável, a interface mostra o campo como não confirmado.
const FonteSchema = z.object({
  documento: z.string(),
  pagina: z.number().int(),
  trecho_literal: z.string(),
});

function campo<T extends z.ZodType>(valor: T) {
  return z.object({
    valor: valor.nullable(),
    tipo: z.enum(["fato", "interpretacao"]),
    fonte: FonteSchema.nullable(),
    encontrado: z.boolean(),
  });
}

const texto = campo(z.string());
const simNao = campo(z.boolean());

export const HABILITACAO_CATEGORIES_FOR_AI = [
  "SOCIETARIO",
  "CERTIDAO",
  "ECONOMICO_FINANCEIRA",
  "ATESTADO",
  "DECLARACAO",
  "PROPOSTA_COMERCIAL",
  "ANEXO_ESPECIFICO",
] as const;

export const TenderAnalysisSchema = z.object({
  resumo: texto,
  identificacao: z.object({
    orgao: texto,
    objeto: texto,
    modalidade: texto,
    numero_edital: texto,
    criterio_julgamento: texto,
  }),
  prazos: z.object({
    abertura_sessao: texto,
    limite_esclarecimentos: texto,
    limite_impugnacao: texto,
    limite_propostas: texto,
    validade_proposta: texto,
    vigencia_contrato: texto,
    prazo_execucao: texto,
    prazo_pagamento: texto,
  }),
  valores_e_condicoes: z.object({
    valor_estimado: texto,
    garantia_proposta: texto,
    garantia_contratual: texto,
    visita_tecnica_exigida: simNao,
    exclusivo_me_epp: simNao,
    consorcio_permitido: simNao,
    subcontratacao_permitida: simNao,
  }),
  habilitacao_exigida: z.array(
    z.object({
      categoria: z.enum(HABILITACAO_CATEGORIES_FOR_AI),
      exigencia: texto,
    }),
  ),
  requisitos_tecnicos: z.array(texto),
  riscos: z.array(
    z.object({
      severidade: z.enum(["baixa", "media", "alta"]),
      descricao: texto,
    }),
  ),
  lacunas: z.array(z.string()),
  perguntas_para_esclarecimento: z.array(z.string()),
});

export type TenderAnalysisResult = z.infer<typeof TenderAnalysisSchema>;
