import type { DB } from "../index.js";

/**
 * Atomically increment and return the next ticket number for a guild.
 * Uses an UPSERT with RETURNING so concurrent opens can't collide.
 */
export function nextTicketNumber(db: DB, guildId: string): number {
  const row = db
    .prepare(
      `INSERT INTO ticket_counter (guild_id, last_number) VALUES (?, 1)
       ON CONFLICT(guild_id) DO UPDATE SET last_number = last_number + 1
       RETURNING last_number`,
    )
    .get(guildId) as { last_number: number };
  return row.last_number;
}

export function peekTicketNumber(db: DB, guildId: string): number {
  const row = db
    .prepare(`SELECT last_number FROM ticket_counter WHERE guild_id = ?`)
    .get(guildId) as { last_number: number } | undefined;
  return row?.last_number ?? 0;
}
