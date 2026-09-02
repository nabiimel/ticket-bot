import type { GuildConfig } from "@ticketbot/shared";

export interface StaffStatus {
  /** false → render no status line at all. */
  show: boolean;
  open: boolean;
  /** Human "back at" hint for the closed state, or null. */
  backAt: string | null;
}

const DOW: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};
const DAY_NAME = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function nowInTz(tz: string, at: Date): { dow: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { dow: DOW[wd] ?? 0, minute: h * 60 + m };
}

function fmt(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Work out whether staff are "on" right now from the guild's coverage hours. */
export function computeStaffStatus(
  cfg: GuildConfig,
  at = new Date(),
): StaffStatus {
  if (!cfg.staffStatusEnabled) return { show: false, open: true, backAt: null };
  if (cfg.staffStatusOverride === "open")
    return { show: true, open: true, backAt: null };
  if (cfg.staffStatusOverride === "closed")
    return { show: true, open: false, backAt: null };

  const hrs = cfg.staffHours;
  if (!hrs?.tz || !Array.isArray(hrs.days) || hrs.days.length !== 7)
    return { show: false, open: true, backAt: null };

  let cur: { dow: number; minute: number };
  try {
    cur = nowInTz(hrs.tz, at);
  } catch {
    return { show: false, open: true, backAt: null };
  }

  const today = hrs.days[cur.dow];
  if (today && cur.minute >= today[0] && cur.minute < today[1]) {
    return { show: true, open: true, backAt: null };
  }

  for (let i = 0; i < 8; i++) {
    const d = (cur.dow + i) % 7;
    const w = hrs.days[d];
    if (!w) continue;
    if (i === 0 && cur.minute >= w[0]) continue; // today's window has passed
    const when = i === 0 ? "today" : i === 1 ? "tomorrow" : DAY_NAME[d];
    return { show: true, open: false, backAt: `${when} at ${fmt(w[0])}` };
  }
  return { show: true, open: false, backAt: null };
}

/** The line prepended to a published panel message, or undefined. */
export function staffStatusLine(s: StaffStatus): string | undefined {
  if (!s.show) return undefined;
  if (s.open) {
    return "🟢 **Staff are online** — open a ticket and someone will be with you.";
  }
  return s.backAt
    ? `🌙 **Staff are offline** — back ${s.backAt}. You can still open a ticket and we'll reply then.`
    : "🌙 **Staff are offline** — you can still open a ticket and we'll reply when we're back.";
}

/** A short key for change-detection in the scheduler. */
export function staffStatusKey(cfg: GuildConfig): string {
  if (!cfg.staffStatusEnabled) return "off";
  const s = computeStaffStatus(cfg);
  return s.show ? `${s.open ? "open" : "closed"}` : "off";
}
