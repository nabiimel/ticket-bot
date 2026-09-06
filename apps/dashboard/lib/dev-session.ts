import { timingSafeEqual } from "node:crypto";

/**
 * Optional developer back-door login. Entirely inert unless
 * `DEV_LOGIN_PASSWORD` is set in the environment — no env var, no code path,
 * no button. When set, it lets the bot operator sign in without Discord OAuth
 * and act as `admin` on every server the bot is in.
 *
 * Keep the secret long and random (`openssl rand -base64 24`). This is a
 * skeleton key to every tenant's data.
 */
export const DEV_LOGIN_ENABLED = !!process.env.DEV_LOGIN_PASSWORD;

/** Constant-time compare against the configured secret. */
export function devPasswordMatches(input: unknown): boolean {
  const secret = process.env.DEV_LOGIN_PASSWORD ?? "";
  if (!secret) return false;
  const given = typeof input === "string" ? input : "";
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) {
    // Still spend the comparison so length isn't a timing oracle.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

// Crude in-process throttle: at most N attempts per rolling minute across the
// whole server. With a strong secret this makes online brute force hopeless;
// it's not meant to survive a restart or span replicas.
const attempts: number[] = [];
const MAX_PER_MINUTE = 10;

export function devLoginThrottled(): boolean {
  const now = Date.now();
  while (attempts.length > 0 && now - attempts[0] > 60_000) attempts.shift();
  if (attempts.length >= MAX_PER_MINUTE) return true;
  attempts.push(now);
  return false;
}
