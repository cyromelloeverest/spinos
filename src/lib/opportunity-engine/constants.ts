export const SEARCH_COOLDOWN_MS = 2 * 24 * 60 * 60 * 1000;

export function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
