import {
  DASHBOARD_LEVELS,
  levelAtLeast,
  type DashboardLevel,
} from "@ticketbot/shared";
import type { DB } from "../index.js";

export interface DashboardGrant {
  roleId: string;
  level: DashboardLevel;
}

function isLevel(v: unknown): v is DashboardLevel {
  return typeof v === "string" && (DASHBOARD_LEVELS as string[]).includes(v);
}

export function listGrants(db: DB, guildId: string): DashboardGrant[] {
  return db
    .prepare(`SELECT role_id, level FROM dashboard_grants WHERE guild_id = ?`)
    .all(guildId)
    .map((r: any) => ({ roleId: r.role_id, level: r.level as DashboardLevel }))
    .filter((g) => isLevel(g.level));
}

export function setGrant(
  db: DB,
  guildId: string,
  roleId: string,
  level: DashboardLevel,
): void {
  db.prepare(
    `INSERT INTO dashboard_grants (guild_id, role_id, level) VALUES (?, ?, ?)
     ON CONFLICT(guild_id, role_id) DO UPDATE SET level = excluded.level`,
  ).run(guildId, roleId, level);
}

export function removeGrant(db: DB, guildId: string, roleId: string): void {
  db.prepare(
    `DELETE FROM dashboard_grants WHERE guild_id = ? AND role_id = ?`,
  ).run(guildId, roleId);
}

/** Highest level any of `roleIds` is granted, or null if none. */
export function resolveLevel(
  db: DB,
  guildId: string,
  roleIds: string[],
): DashboardLevel | null {
  if (roleIds.length === 0) return null;
  const grants = listGrants(db, guildId);
  let best: DashboardLevel | null = null;
  for (const g of grants) {
    if (!roleIds.includes(g.roleId)) continue;
    if (!best || levelAtLeast(g.level, best)) best = g.level;
  }
  return best;
}
