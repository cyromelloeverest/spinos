export const SEARCH_COOLDOWN_MS = 2 * 24 * 60 * 60 * 1000;

// Quando a busca roda mas não encontra nenhuma oportunidade real, o cliente
// não recebeu valor nenhum — não faz sentido fazer ele esperar os 2 dias
// inteiros do cooldown normal pra tentar de novo.
export const EMPTY_RESULT_RETRY_MS = 6 * 60 * 60 * 1000;

export function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
