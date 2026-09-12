import type { DashboardPresenceEntry } from "@ticketbot/shared";
import type { DB } from "../index.js";

/** Record (or refresh) that a user is currently viewing this guild's dashboard. */
export function touch(
  db: DB,
  guildId: string,
  userId: string,
  name: string,
  avatarUrl: string | null,
): void {
  db.prepare(
    `INSERT INTO dashboard_presence (guild_id, user_id, name, avatar_url, last_seen_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET
       name = excluded.name,
       avatar_url = excluded.avatar_url,
       last_seen_at = excluded.last_seen_at`,
  ).run(
    guildId,
    userId,
    name.slice(0, 100),
    avatarUrl,
    Math.floor(Date.now() / 1000),
  );
}

/** Everyone with a heartbeat newer than `sinceUnix`, most recent first. */
export function listActive(
  db: DB,
  guildId: string,
  sinceUnix: number,
): DashboardPresenceEntry[] {
  return db
    .prepare(
      `SELECT user_id, name, avatar_url, last_seen_at FROM dashboard_presence
       WHERE guild_id = ? AND last_seen_at >= ?
       ORDER BY last_seen_at DESC`,
    )
    .all(guildId, sinceUnix)
    .map((r: any) => ({
      userId: r.user_id,
      name: r.name,
      avatarUrl: r.avatar_url,
      lastSeenAt: r.last_seen_at,
    }));
}
