// "1.234,56", "R$ 1234,56", "1234.56", "1.234" → número. Vazio → null. Inválido →
// undefined. "1.234" com ponto e exatamente 3 dígitos é milhar (padrão brasileiro).
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

export function formatBRL(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
