// Dias de negócio no horário de Brasília (UTC-3, sem horário de verão desde 2019).
// O fuso por organização vem com o pacote de nicho; até lá, todo mundo é Brasília.
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDayBRT(now: Date = new Date()): Date {
  const local = new Date(now.getTime() - BRT_OFFSET_MS);
  const midnightLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(midnightLocal + BRT_OFFSET_MS);
}

export function endOfDayBRT(now: Date = new Date()): Date {
  return new Date(startOfDayBRT(now).getTime() + DAY_MS);
}

// Prazo "daqui a N dias às 9h" em Brasília; sábado e domingo caem na segunda.
export function businessDueDate(daysFromNow: number, now: Date = new Date()): Date {
  const base = new Date(startOfDayBRT(now).getTime() + daysFromNow * DAY_MS + 9 * 60 * 60 * 1000);
  const dow = new Date(base.getTime() - BRT_OFFSET_MS).getUTCDay(); // 0 domingo, 6 sábado
  if (dow === 6) return new Date(base.getTime() + 2 * DAY_MS);
  if (dow === 0) return new Date(base.getTime() + DAY_MS);
  return base;
}

// <input type="datetime-local"> ("YYYY-MM-DDTHH:mm") é horário de Brasília.
// Vazio → null; inválido → undefined.
export function parseBrasiliaDateTime(value: string): Date | null | undefined {
  const v = value.trim();
  if (v === "") return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(v);
  if (!m) return undefined;
  const d = new Date(`${m[1]}T${m[2]}:${m[3]}:00-03:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  const roundTrip = new Date(d.getTime() - BRT_OFFSET_MS).toISOString().slice(0, 16);
  if (roundTrip !== `${m[1]}T${m[2]}:${m[3]}`) return undefined; // data impossível, ex. 31/02
  return d;
}

export function toBrasiliaInput(d: Date | null | undefined): string {
  return d ? new Date(d.getTime() - BRT_OFFSET_MS).toISOString().slice(0, 16) : "";
}

export function formatBrasilia(d: Date | null | undefined): string {
  return d ? d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—";
}
