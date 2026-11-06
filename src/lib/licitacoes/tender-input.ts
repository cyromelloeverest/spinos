// Conversão de campos de formulário da licitação (puro, testável).

// "1.234,56", "R$ 1234,56", "1234.56", "1.234" → número. Vazio → null.
// Inválido → undefined. "1.234" com ponto + exatamente 3 dígitos é milhar
// (padrão brasileiro), não 1,234.
export function parseMoneyInput(value: string): number | null | undefined {
  const v = value.replace(/R\$/gi, "").replace(/\s/g, "");
  if (v === "") return null;
  let normalized: string;
  if (v.includes(",")) normalized = v.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(v)) normalized = v.replace(/\./g, "");
  else normalized = v;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return undefined;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n > 1e13) return undefined;
  return n;
}

// <input type="datetime-local"> ("YYYY-MM-DDTHH:mm") é horário de Brasília
// (UTC-3, sem horário de verão desde 2019). Vazio → null; inválido → undefined.
export function parseBrasiliaDateTime(value: string): Date | null | undefined {
  const v = value.trim();
  if (v === "") return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(v);
  if (!m) return undefined;
  const d = new Date(`${m[1]}T${m[2]}:${m[3]}:00-03:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  const roundTrip = new Date(d.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 16);
  if (roundTrip !== `${m[1]}T${m[2]}:${m[3]}`) return undefined; // data impossível, ex. 31/02
  return d;
}

// Date → valor de <input type="datetime-local"> no horário de Brasília.
export function toBrasiliaInput(d: Date | null): string {
  return d ? new Date(d.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 16) : "";
}

export function formatBRL(n: number | null): string {
  return n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatBrasilia(d: Date | null): string {
  return d ? d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—";
}
