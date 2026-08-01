// Resolução de entidade para empresas encontradas pela IA em buscas diferentes.
// A mesma empresa real pode aparecer com nomes ligeiramente diferentes entre
// execuções ("Sany Brasil" vs "Sany Brasil (Sany Heavy Industry)"). Sem CNPJ
// oficial (fonte futura: Receita Federal), usamos similaridade de nome como
// heurística — imperfeita, mas evita duplicar a mesma empresa a cada busca.

const STOPWORDS = new Set([
  "do",
  "da",
  "de",
  "dos",
  "das",
  "e",
  "ltda",
  "sa",
  "s",
  "a",
  "brasil",
  "brazil",
  "group",
  "grupo",
  "industria",
  "industrias",
  "comercio",
  "servicos",
  "unidade",
  "fabrica",
  "nova",
  "south",
  "america",
]);

export function normalizeCompanyName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .join(" ")
    .trim();
}

function nameSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(" ").filter(Boolean));
  const setB = new Set(b.split(" ").filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let overlap = 0;
  for (const word of setA) if (setB.has(word)) overlap++;
  return overlap / Math.min(setA.size, setB.size);
}

const SIMILARITY_THRESHOLD = 0.6;

export function findBestMatch<T extends { name: string; city: string | null; state: string | null }>(
  candidateName: string,
  candidateCity: string | null,
  pool: T[],
): T | null {
  const normalizedCandidate = normalizeCompanyName(candidateName);
  if (!normalizedCandidate) return null;

  let best: T | null = null;
  let bestScore = 0;

  for (const existing of pool) {
    const normalizedExisting = normalizeCompanyName(existing.name);
    const similarity = nameSimilarity(normalizedCandidate, normalizedExisting);
    if (similarity < SIMILARITY_THRESHOLD) continue;

    // Mesmo nome em cidades claramente diferentes provavelmente não é a
    // mesma empresa (ex: unidades regionais distintas) — exige a cidade
    // bater quando ambas são conhecidas.
    if (candidateCity && existing.city && candidateCity !== existing.city) continue;

    if (similarity > bestScore) {
      bestScore = similarity;
      best = existing;
    }
  }

  return best;
}
