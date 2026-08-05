// Iniciais (até 2 letras) pro avatar de empresa/organização. Remove qualquer
// trecho entre parênteses (ex: "SIG (unidade de Vinhedo)" é só "SIG" pra
// efeito de iniciais) e usa a primeira letra de verdade de cada palavra —
// nunca w[0] cru, que pega pontuação como "(" quando a palavra começa com ela.
export function initials(name: string): string {
  const cleaned = name.replace(/\([^)]*\)/g, " ");
  const letters = cleaned
    .split(/\s+/)
    .filter((word) => word.length > 1)
    .map((word) => word.match(/\p{L}/u)?.[0])
    .filter((char): char is string => Boolean(char));

  return letters.slice(0, 2).join("").toUpperCase();
}
