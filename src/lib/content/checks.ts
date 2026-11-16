import type { NichePack } from "@/packs/schema";

/** Roda as verificações do pacote no texto. Devolve um aviso por regra violada, com o trecho. */
export function runChecks(pack: NichePack | null, text: string): string[] {
  const warnings: string[] = [];
  for (const check of pack?.contentChecks ?? []) {
    const match = new RegExp(check.pattern, "i").exec(text);
    if (match) warnings.push(`${check.message} (trecho: "${match[0].slice(0, 40)}")`);
  }
  return warnings;
}

export const SIGNATURE_PLACEHOLDER = "[responsável técnico e registro profissional]";

/**
 * Assinatura exigida pelo pacote (ex.: responsável e registro no CRC). Sem os dados da organização
 * devolve o espaço em branco para a pessoa preencher e um aviso, nunca inventa nome nem número.
 */
export function buildSignature(pack: NichePack | null, org: { name: string; responsibleName: string | null; professionalRegistration: string | null }): { text: string; warning: string | null } | null {
  if (!pack?.contentSignature) return null;
  const complete = Boolean(org.responsibleName && org.professionalRegistration);
  const text = pack.contentSignature
    .replace(/\{\{\s*negocio\s*\}\}/g, org.name)
    .replace(/\{\{\s*responsavel\s*\}\}/g, org.responsibleName ?? SIGNATURE_PLACEHOLDER)
    .replace(/\{\{\s*registro\s*\}\}/g, org.professionalRegistration ?? SIGNATURE_PLACEHOLDER);
  return { text, warning: complete ? null : "Falta o responsável técnico e o registro profissional no Perfil da empresa: a assinatura ficou em branco e é obrigatória na divulgação." };
}
