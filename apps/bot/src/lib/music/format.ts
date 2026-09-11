export function fmtDuration(seconds: number | null): string {
  if (seconds == null) return "Live/Unknown";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
