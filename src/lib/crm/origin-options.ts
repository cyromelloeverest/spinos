import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

// Opções da "Origem do lead" na gaveta da oportunidade. O pacote de nicho vai poder
// trocar a lista; até lá é esta, genérica.
export const ORIGIN_OPTIONS = [
  { key: "spinos", label: "Prospecção do Spinos", kind: "PROSPECTING" },
  { key: "indicacao", label: "Indicação", kind: "REFERRAL" },
  { key: "site", label: "Site ou landing page", kind: "LANDING_PAGE" },
  { key: "google_ads", label: "Anúncio no Google", kind: "AD" },
  { key: "meta_ads", label: "Anúncio na Meta", kind: "AD" },
  { key: "network", label: "Network e relacionamento", kind: "MANUAL" },
  { key: "outro", label: "Outro", kind: "OTHER" },
] as const;

export type OriginKey = (typeof ORIGIN_OPTIONS)[number]["key"];

export function originLabel(channel: string | null | undefined): string {
  return ORIGIN_OPTIONS.find((o) => o.key === channel)?.label ?? "Não informada";
}

// Troca a origem do PRIMEIRO toque da conta (cria se não houver).
export async function setFirstTouchOrigin(tx: Tx, input: { organizationId: string; accountId: string; originKey: string }) {
  const option = ORIGIN_OPTIONS.find((o) => o.key === input.originKey);
  if (!option) throw new Error("Origem desconhecida");
  const first = await tx.origin.findFirst({ where: { organizationId: input.organizationId, accountId: input.accountId, isFirstTouch: true } });
  if (first) {
    await tx.origin.update({ where: { id: first.id }, data: { kind: option.kind, channel: option.key } });
  } else {
    await tx.origin.create({ data: { organizationId: input.organizationId, accountId: input.accountId, kind: option.kind, channel: option.key, isFirstTouch: true } });
  }
}
