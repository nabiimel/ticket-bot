import type { BlacklistEntry } from "@ticketbot/shared";
import type { DB } from "../index.js";

function map(r: any): BlacklistEntry {
  return {
    guildId: r.guild_id,
    userId: r.user_id,
    reason: r.reason,
    addedBy: r.added_by,
    addedAt: r.added_at,
  };
}

export function isBlacklisted(
  db: DB,
  guildId: string,
  userId: string,
): boolean {
  const row = db
    .prepare(`SELECT 1 AS ok FROM blacklist WHERE guild_id = ? AND user_id = ?`)
    .get(guildId, userId);
  return !!row;
}

export function addToBlacklist(
  db: DB,
  guildId: string,
  userId: string,
  addedBy: string,
  reason: string | null,
): void {
  db.prepare(
    `INSERT INTO blacklist (guild_id, user_id, reason, added_by, added_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET reason = excluded.reason`,
  ).run(guildId, userId, reason, addedBy, Math.floor(Date.now() / 1000));
}

export function removeFromBlacklist(
  db: DB,
  guildId: string,
  userId: string,
): boolean {
  const info = db
    .prepare(`DELETE FROM blacklist WHERE guild_id = ? AND user_id = ?`)
    .run(guildId, userId);
  return info.changes > 0;
}

export function listBlacklist(db: DB, guildId: string): BlacklistEntry[] {
  return db
    .prepare(
      `SELECT * FROM blacklist WHERE guild_id = ? ORDER BY added_at DESC`,
    )
    .all(guildId)
    .map(map);
}
