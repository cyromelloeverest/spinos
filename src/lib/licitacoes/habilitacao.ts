// Regras puras do perfil de habilitação (sem I/O, testáveis).

export const HABILITACAO_CATEGORY_LABEL = {
  SOCIETARIO: "Documentos societários",
  CERTIDAO: "Certidões e regularidade fiscal",
  ECONOMICO_FINANCEIRA: "Qualificação econômico-financeira",
  ATESTADO: "Atestados de capacidade técnica",
  DECLARACAO: "Declarações",
  PROPOSTA_COMERCIAL: "Proposta comercial",
  ANEXO_ESPECIFICO: "Anexos específicos",
} as const;

export type HabilitacaoCategoryKey = keyof typeof HABILITACAO_CATEGORY_LABEL;

export const HABILITACAO_CATEGORIES = Object.keys(HABILITACAO_CATEGORY_LABEL) as HabilitacaoCategoryKey[];

export function isHabilitacaoCategory(value: string): value is HabilitacaoCategoryKey {
  return (HABILITACAO_CATEGORIES as string[]).includes(value);
}

export type ValidityStatus = "sem_validade" | "vigente" | "vence_em_breve" | "vencido";

export const EXPIRING_SOON_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

// Vence "no fim do dia" da data informada: um documento com validade hoje
// ainda vale hoje. Compara por dia (UTC), não por instante, porque o campo
// é só data.
export function validityStatus(expiresAt: Date | null, now: Date = new Date()): ValidityStatus {
  if (!expiresAt) return "sem_validade";
  const today = Math.floor(now.getTime() / DAY_MS);
  const expiry = Math.floor(expiresAt.getTime() / DAY_MS);
  if (expiry < today) return "vencido";
  if (expiry - today <= EXPIRING_SOON_DAYS) return "vence_em_breve";
  return "vigente";
}

export const VALIDITY_LABEL: Record<ValidityStatus, string> = {
  sem_validade: "Sem validade informada",
  vigente: "Vigente",
  vence_em_breve: "Vence em breve",
  vencido: "Vencido",
};

// "YYYY-MM-DD" do <input type="date"> → Date em UTC (meia-noite). Vazio →
// null. Qualquer outra coisa → undefined (inválido).
export function parseDateInput(value: string): Date | null | undefined {
  const v = value.trim();
  if (v === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  if (d.toISOString().slice(0, 10) !== v) return undefined; // ex.: 2026-02-31
  return d;
}

// Uma "versão atual" é a que nenhuma outra aponta como anterior. Usado pra
// listar só o documento vigente de cada cadeia de renovações.
export function currentVersions<T extends { id: string; previousVersionId: string | null }>(docs: T[]): T[] {
  const superseded = new Set(docs.map((d) => d.previousVersionId).filter((id): id is string => !!id));
  return docs.filter((d) => !superseded.has(d.id));
}
