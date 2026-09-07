import { timingSafeEqual } from "node:crypto";

/**
 * Robux stock sync (Option A). The seller runs a userscript on their own
 * machine that reads their Roblox balance and POSTs it to /api/roblox-stock
 * with this shared secret. Inert unless ROBLOX_STOCK_SECRET is set — the
 * seller's Roblox session never touches the server.
 */
export const STOCK_SYNC_ENABLED = !!process.env.ROBLOX_STOCK_SECRET;

export function stockSecretMatches(input: unknown): boolean {
  const secret = process.env.ROBLOX_STOCK_SECRET ?? "";
  if (!secret) return false;
  const given = typeof input === "string" ? input : "";
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
