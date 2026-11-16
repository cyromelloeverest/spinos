import type { Prisma } from "@/generated/prisma/client";
import { ORIGIN_OPTIONS } from "@/lib/crm/origin-options";
import { parseMoneyInput } from "@/lib/crm/money";

type Tx = Prisma.TransactionClient;

/*
 * Investimento em marketing lançado à mão ou por CSV (na v1 não há conector com Google Ads nem
 * Meta). Cada lançamento é uma campanha com valor, canal e data; o relatório soma por canal.
 */

export class SpendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpendError";
  }
}

export const SPEND_CHANNELS = ORIGIN_OPTIONS.map((o) => ({ key: o.key as string, label: o.label, kind: o.kind }));

/** "2026-11-16" ou "16/11/2026" → meio-dia em Brasília (evita virar o dia anterior em UTC). */
export function parseSpendDate(value: string): Date | undefined {
  const v = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3]] : br ? [br[3], br[2], br[1]] : [];
  if (!y) return undefined;
  const date = new Date(`${y}-${m}-${d}T12:00:00-03:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  // Data impossível (31/02) o JavaScript empurra para o mês seguinte: o ida e volta pega.
  return new Date(date.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10) === `${y}-${m}-${d}` ? date : undefined;
}

function channelKey(input: string): string | undefined {
  const t = input.trim().toLowerCase();
  const byKey = SPEND_CHANNELS.find((c) => c.key === t);
  if (byKey) return byKey.key;
  const byLabel = SPEND_CHANNELS.find((c) => c.label.toLowerCase() === t);
  if (byLabel) return byLabel.key;
  if (/google/.test(t)) return "google_ads";
  if (/meta|facebook|instagram/.test(t)) return "meta_ads";
  return undefined;
}

export type SpendInput = { name: string; channel: string; amount: string; date: string };

export async function addSpend(tx: Tx, organizationId: string, input: SpendInput) {
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new SpendError("Dê um nome ao lançamento, ex.: Google Ads de novembro.");
  const channel = channelKey(input.channel);
  if (!channel) throw new SpendError("Escolha o canal do investimento.");
  const amount = parseMoneyInput(input.amount);
  if (amount == null || amount <= 0) throw new SpendError("Informe um valor maior que zero, ex.: 1.500,00.");
  const startsAt = input.date.trim() ? parseSpendDate(input.date) : new Date();
  if (!startsAt) throw new SpendError("Data inválida. Use dd/mm/aaaa.");
  const option = SPEND_CHANNELS.find((c) => c.key === channel)!;
  return tx.campaign.create({ data: { organizationId, kind: option.kind === "AD" ? "AD" : "OTHER", channel, name, spendBRL: amount, startsAt } });
}

/**
 * CSV simples: data;canal;valor;nome (opcional). Aceita ; ou , como separador. Linha com erro não
 * derruba as demais: volta na lista de problemas, com o número da linha.
 */
export async function importSpendCsv(tx: Tx, organizationId: string, text: string) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const problems: string[] = [];
  let imported = 0;
  for (const [i, line] of lines.entries()) {
    const cells = line.includes(";") ? line.split(";") : line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    const [date, channel, amount, ...rest] = cells.map((c) => c.trim().replace(/^"|"$/g, ""));
    if (i === 0 && /data|date/i.test(date ?? "")) continue; // cabeçalho
    try {
      await addSpend(tx, organizationId, { date: date ?? "", channel: channel ?? "", amount: amount ?? "", name: rest.join(" ").trim() || `Investimento ${date}` });
      imported += 1;
    } catch (e) {
      if (!(e instanceof SpendError)) throw e;
      problems.push(`Linha ${i + 1}: ${e.message}`);
    }
  }
  return { imported, problems: problems.slice(0, 10) };
}

export async function deleteSpend(tx: Tx, organizationId: string, id: string) {
  await tx.campaign.deleteMany({ where: { id, organizationId, spendBRL: { not: null } } });
}
