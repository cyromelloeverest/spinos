/**
 * Fixed-window counter held in memory. Cheap (no database round trip), but it
 * only sees the traffic of one serverless instance, so it is a brake for
 * bursts, not a guarantee: use the shared `rate_limit` table when the limit
 * must hold across instances. The key map is bounded, so a flood of unique
 * keys cannot grow memory without limit.
 */
export function createWindowLimiter(options: { limit: number; windowMs: number; maxKeys?: number; now?: () => number }) {
  const { limit, windowMs, maxKeys = 5000, now = Date.now } = options;
  const windows = new Map<string, { start: number; count: number }>();

  return function allow(key: string): boolean {
    const t = now();
    const current = windows.get(key);
    if (!current || t - current.start >= windowMs) {
      if (!current && windows.size >= maxKeys) {
        for (const [k, w] of windows) if (t - w.start >= windowMs) windows.delete(k);
        if (windows.size >= maxKeys) windows.delete(windows.keys().next().value!);
      }
      windows.set(key, { start: t, count: 1 });
      return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
  };
}
