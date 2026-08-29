import type { DB } from "../index.js";

export interface GuildStats {
  windowDays: number;
  openCount: number;
  closedCount: number;
  totalCount: number;
  byCategory: { categoryId: number | null; label: string; count: number }[];
  avgSecondsToClaim: number | null;
  avgSecondsToClose: number | null;
  avgRating: number | null;
  ratingCount: number;
  perStaff: { staffId: string; claimed: number; closed: number }[];
}

/** Aggregate ticket metrics for a guild over the last `windowDays` days. */
export function getGuildStats(
  db: DB,
  guildId: string,
  windowDays = 30,
): GuildStats {
  const since = Math.floor(Date.now() / 1000) - windowDays * 86400;

  const counts = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status != 'closed' THEN 1 ELSE 0 END) AS open,
         SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed,
         COUNT(*) AS total
       FROM tickets
       WHERE guild_id = ? AND created_at >= ?`,
    )
    .get(guildId, since) as { open: number; closed: number; total: number };

  const byCategory = db
    .prepare(
      `SELECT t.category_id AS categoryId,
              COALESCE(c.label, 'Uncategorized') AS label,
              COUNT(*) AS count
       FROM tickets t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.guild_id = ? AND t.created_at >= ?
       GROUP BY t.category_id
       ORDER BY count DESC`,
    )
    .all(guildId, since) as GuildStats["byCategory"];

  const timing = db
    .prepare(
      `SELECT
         AVG(claimed_at - created_at) AS toClaim,
         AVG(closed_at - created_at) AS toClose
       FROM tickets
       WHERE guild_id = ? AND created_at >= ?`,
    )
    .get(guildId, since) as { toClaim: number | null; toClose: number | null };

  const rating = db
    .prepare(
      `SELECT AVG(score) AS avg, COUNT(*) AS n
       FROM ratings WHERE guild_id = ? AND created_at >= ?`,
    )
    .get(guildId, since) as { avg: number | null; n: number };

  const perStaff = db
    .prepare(
      `SELECT staffId,
              SUM(claimed) AS claimed,
              SUM(closed) AS closed
       FROM (
         SELECT claimed_by AS staffId, 1 AS claimed, 0 AS closed
         FROM tickets
         WHERE guild_id = @g AND claimed_by IS NOT NULL AND created_at >= @s
         UNION ALL
         SELECT closed_by AS staffId, 0 AS claimed, 1 AS closed
         FROM tickets
         WHERE guild_id = @g AND closed_by IS NOT NULL AND created_at >= @s
       )
       GROUP BY staffId
       ORDER BY (claimed + closed) DESC`,
    )
    .all({ g: guildId, s: since }) as GuildStats["perStaff"];

  return {
    windowDays,
    openCount: counts.open ?? 0,
    closedCount: counts.closed ?? 0,
    totalCount: counts.total ?? 0,
    byCategory,
    avgSecondsToClaim: timing.toClaim,
    avgSecondsToClose: timing.toClose,
    avgRating: rating.avg,
    ratingCount: rating.n ?? 0,
    perStaff,
  };
}
