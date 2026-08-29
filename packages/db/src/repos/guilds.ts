import type { DB } from "../index.js";

export interface GuildRow {
  guildId: string;
  name: string | null;
  icon: string | null;
  addedAt: number;
  removedAt: number | null;
}

function map(r: any): GuildRow {
  return {
    guildId: r.guild_id,
    name: r.name,
    icon: r.icon,
    addedAt: r.added_at,
    removedAt: r.removed_at,
  };
}

/** Upsert a guild as present (bot joined / on ready sweep). */
export function markGuildPresent(
  db: DB,
  guildId: string,
  name: string | null,
  icon: string | null,
): void {
  db.prepare(
    `INSERT INTO guilds (guild_id, name, icon, added_at, removed_at)
     VALUES (?, ?, ?, ?, NULL)
     ON CONFLICT(guild_id) DO UPDATE SET
       name = excluded.name,
       icon = excluded.icon,
       removed_at = NULL`,
  ).run(guildId, name, icon, Math.floor(Date.now() / 1000));
}

/** Mark a guild as no longer served by the bot (bot removed). */
export function markGuildRemoved(db: DB, guildId: string): void {
  db.prepare(`UPDATE guilds SET removed_at = ? WHERE guild_id = ?`).run(
    Math.floor(Date.now() / 1000),
    guildId,
  );
}

export function isGuildPresent(db: DB, guildId: string): boolean {
  const row = db
    .prepare(
      `SELECT 1 AS ok FROM guilds WHERE guild_id = ? AND removed_at IS NULL`,
    )
    .get(guildId) as { ok: number } | undefined;
  return !!row;
}

export function getGuild(db: DB, guildId: string): GuildRow | null {
  const row = db
    .prepare(`SELECT * FROM guilds WHERE guild_id = ?`)
    .get(guildId);
  return row ? map(row) : null;
}

export function listPresentGuilds(db: DB): GuildRow[] {
  return db
    .prepare(`SELECT * FROM guilds WHERE removed_at IS NULL ORDER BY name`)
    .all()
    .map(map);
}
