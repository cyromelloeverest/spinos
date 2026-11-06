// Preço por milhão de tokens (US$). Modelo desconhecido usa o mais caro da
// tabela — erra pra cima, nunca esconde custo.
const PRICES: Array<{ prefix: string; input: number; output: number }> = [
  { prefix: "claude-opus-5-5", input: 4, output: 20 },
  { prefix: "claude-opus-5", input: 5, output: 25 },
  { prefix: "claude-sonnet-5", input: 2, output: 10 },
  { prefix: "claude-fable-5", input: 10, output: 50 },
];
const FALLBACK = { input: 10, output: 50 };

export function estimateCostUSD(
  model: string,
  usage: { input_tokens: number | null; output_tokens: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null },
): number {
  // Prefixo mais longo primeiro: "claude-opus-5-5" antes de "claude-opus-5".
  const price = [...PRICES].sort((a, b) => b.prefix.length - a.prefix.length).find((p) => model.startsWith(p.prefix)) ?? FALLBACK;
  const input = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  return (input / 1_000_000) * price.input + (usage.output_tokens / 1_000_000) * price.output;
}

export const ANALYSIS_CREDITS = 2;
export const DEFAULT_ANALYSIS_MODEL = "claude-opus-5";
