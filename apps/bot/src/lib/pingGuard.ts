import { type Message } from "discord.js";
import type { GuildConfig } from "@ticketbot/shared";
import { hit } from "./cooldown.js";
import { alertAdmins } from "./preflight.js";
import { logger } from "./logger.js";

/**
 * Ping guard: when a ticket opener repeatedly @-mentions the configured seller
 * (a user id or a role id) inside a short window, warn them — escalating each
 * time, and alerting admins on the third strike. Never punishes.
 */

// key -> ascending list of ping timestamps (ms), pruned to the window.
const pings = new Map<string, number[]>();
// key -> how many warnings this opener has been given in this channel.
const strikes = new Map<string, number>();

/** Record a ping and report whether the opener is now over the limit. */
export function slidingWindowHit(
  store: Map<string, number[]>,
  key: string,
  now: number,
  windowMs: number,
  max: number,
): { over: boolean; count: number } {
  const arr = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  store.set(key, arr);
  // Opportunistic cleanup so the map can't grow without bound.
  if (store.size > 5000) {
    for (const [k, v] of store) {
      const last = v[v.length - 1];
      if (last === undefined || now - last > windowMs) store.delete(k);
    }
  }
  return { over: arr.length > max, count: arr.length };
}

function warningFor(strike: number, userId: string): string {
  if (strike <= 1) {
    return `⚠️ <@${userId}> — please stop repeatedly pinging the seller. They've been notified and will reply as soon as they're free.`;
  }
  if (strike === 2) {
    return `⚠️ <@${userId}> — second reminder: no more pinging the seller. If it continues, the admins will be notified.`;
  }
  return `🚫 <@${userId}> — the admins have been notified about repeated ping-spam in this ticket.`;
}

/** Call for every opener message in an open ticket. Cheap no-op when disabled. */
export async function handlePingGuard(
  message: Message<true>,
  cfg: GuildConfig,
): Promise<void> {
  const sellerId = cfg.pingGuardSellerId;
  if (!cfg.pingGuardEnabled || !sellerId) return;

  const mentionedSeller =
    message.mentions.users.has(sellerId) ||
    message.mentions.roles.has(sellerId);
  if (!mentionedSeller) return;

  const key = `${message.guildId}:${message.channelId}:${message.author.id}`;
  const windowMs = Math.max(cfg.pingGuardWindowSecs, 5) * 1000;
  const max = Math.max(cfg.pingGuardMaxPings, 1);
  const { over } = slidingWindowHit(pings, key, Date.now(), windowMs, max);
  if (!over) return;

  // Don't let the warning itself become spam.
  if (!hit(`pingguard-warn:${key}`, 15_000)) return;

  const strike = (strikes.get(key) ?? 0) + 1;
  strikes.set(key, strike);

  try {
    await message.channel.send({
      content: warningFor(strike, message.author.id),
      allowedMentions: { users: [message.author.id] },
    });
  } catch (err) {
    logger.warn("ping guard: warning post failed", err);
  }

  if (strike >= 3) {
    const chanRef = `<#${message.channelId}>`;
    await alertAdmins(
      message.guild,
      cfg,
      `<@${message.author.id}> has been warned ${strike}× for repeatedly pinging the seller in ${chanRef}.`,
    ).catch(() => null);
  }
}

/** Forget a channel's counters once its ticket is gone. */
export function clearPingGuard(guildId: string, channelId: string): void {
  const prefix = `${guildId}:${channelId}:`;
  for (const k of pings.keys()) if (k.startsWith(prefix)) pings.delete(k);
  for (const k of strikes.keys()) if (k.startsWith(prefix)) strikes.delete(k);
}
