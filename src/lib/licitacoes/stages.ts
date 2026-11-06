export const TENDER_STAGE_LABEL = {
  IDENTIFICADA: "Identificada",
  EM_ANALISE: "Em análise",
  AGUARDANDO_DECISAO: "Aguardando decisão",
  APROVADA: "Aprovada para participação",
  PREPARANDO_DOCUMENTACAO: "Preparando documentação",
  PROPOSTA_PRONTA: "Proposta pronta",
  PROPOSTA_ENVIADA: "Proposta enviada",
  EM_JULGAMENTO: "Em julgamento",
  VENCIDA: "Vencida",
  PERDIDA: "Perdida",
  DESCARTADA: "Descartada",
} as const;

export type TenderStageKey = keyof typeof TENDER_STAGE_LABEL;

export const TENDER_DOCUMENT_KIND_LABEL = {
  EDITAL: "Edital",
  TERMO_REFERENCIA: "Termo de referência",
  ANEXO: "Anexo",
  RETIFICACAO: "Retificação",
  ESCLARECIMENTO: "Esclarecimento",
  COMPROVANTE: "Comprovante",
  OUTRO: "Outro",
} as const;
