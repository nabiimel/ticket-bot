import type { DB } from "../index.js";

export interface AuditEntry {
  id: number;
  guildId: string;
  actorId: string;
  action: string;
  summary: string;
  createdAt: number;
}

function map(r: any): AuditEntry {
  return {
    id: r.id,
    guildId: r.guild_id,
    actorId: r.actor_id,
    action: r.action,
    summary: r.summary,
    createdAt: r.created_at,
  };
}

export function logAudit(
  db: DB,
  entry: { guildId: string; actorId: string; action: string; summary: string },
): void {
  db.prepare(
    `INSERT INTO config_audit (guild_id, actor_id, action, summary, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    entry.guildId,
    entry.actorId,
    entry.action,
    entry.summary.slice(0, 500),
    Math.floor(Date.now() / 1000),
  );
}

export function listAudit(db: DB, guildId: string, limit = 100): AuditEntry[] {
  return db
    .prepare(
      `SELECT * FROM config_audit WHERE guild_id = ? ORDER BY id DESC LIMIT ?`,
    )
    .all(guildId, limit)
    .map(map);
}
