/** "45s" / "12m" / "3h" / "2d" from a duration in seconds. "—" when unknown. */
export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const s = Math.round(seconds);
  if (s < 90) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/** "3h ago" from a unix-seconds timestamp. */
export function fmtAgo(unixSeconds: number): string {
  const delta = Date.now() / 1000 - unixSeconds;
  if (delta < 45) return "just now";
  return `${fmtDuration(delta)} ago`;
}
