const stamps = new Map<string, number>();

/**
 * Rate-limit gate. Returns `true` and records the hit when `key` is outside its
 * window; returns `false` (still cooling down) otherwise. In-memory per server
 * process — enough to smooth out repeated dashboard actions.
 */
export function hit(key: string, windowMs: number): boolean {
  const now = Date.now();
  const prev = stamps.get(key);
  if (prev != null && now - prev < windowMs) return false;
  stamps.set(key, now);
  if (stamps.size > 5000) {
    for (const [k, ts] of stamps) {
      if (now - ts > 3_600_000) stamps.delete(k);
    }
  }
  return true;
}
