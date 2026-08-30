import type { DB } from "../index.js";

/**
 * The dashboard notification centre derives its feed on the fly from tickets,
 * ratings, failed jobs and the audit log. The only thing that needs persisting
 * is how far each dashboard user has read, so the unread badge is per-user and
 * survives across devices.
 */

export function getLastSeen(db: DB, guildId: string, userId: string): number {
  const row = db
    .prepare(
      `SELECT last_seen_at FROM notification_reads
       WHERE guild_id = ? AND user_id = ?`,
    )
    .get(guildId, userId) as { last_seen_at: number } | undefined;
  return row?.last_seen_at ?? 0;
}

/** Mark everything up to `at` (unix seconds, default now) as read for this user. */
export function markAllRead(
  db: DB,
  guildId: string,
  userId: string,
  at: number = Math.floor(Date.now() / 1000),
): void {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO notification_reads (guild_id, user_id, last_seen_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET
       last_seen_at = MAX(notification_reads.last_seen_at, excluded.last_seen_at),
       updated_at   = excluded.updated_at`,
  ).run(guildId, userId, at, now);
}
