import type { DB } from "../index.js";

export interface GuildStats {
  windowDays: number;
  openCount: number;
  closedCount: number;
  totalCount: number;
  byCategory: { categoryId: number | null; label: string; count: number }[];
  avgSecondsToClaim: number | null;
  avgSecondsToFirstReply: number | null;
  avgSecondsToClose: number | null;
  avgRating: number | null;
  ratingCount: number;
  perStaff: { staffId: string; claimed: number; closed: number }[];
}

export interface StatsExtras {
  /** Tickets opened per calendar day (UTC), oldest first, sparse. */
  perDay: { day: string; count: number }[];
  /** Rating counts by score (1–5), only scores that occurred. */
  ratingBreakdown: { score: number; count: number }[];
  /** Recent rating comments, newest first. */
  comments: {
    ticketId: number;
    score: number;
    comment: string;
    createdAt: number;
  }[];
}

export interface StatsExportRow {
  number: number;
  category: string;
  openerId: string;
  createdAt: number;
  claimedAt: number | null;
  firstStaffMsgAt: number | null;
  closedAt: number | null;
  closedBy: string | null;
  closeReason: string | null;
  rating: number | null;
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
         AVG(CASE WHEN first_staff_msg_at IS NOT NULL
                  THEN first_staff_msg_at - created_at END) AS toFirstReply,
         AVG(closed_at - created_at) AS toClose
       FROM tickets
       WHERE guild_id = ? AND created_at >= ?`,
    )
    .get(guildId, since) as {
    toClaim: number | null;
    toFirstReply: number | null;
    toClose: number | null;
  };

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
    avgSecondsToFirstReply: timing.toFirstReply,
    avgSecondsToClose: timing.toClose,
    avgRating: rating.avg,
    ratingCount: rating.n ?? 0,
    perStaff,
  };
}

/** Chart / distribution / comment data for the Stats page. */
export function getStatsExtras(
  db: DB,
  guildId: string,
  windowDays = 30,
): StatsExtras {
  const since = Math.floor(Date.now() / 1000) - windowDays * 86400;

  const perDay = db
    .prepare(
      `SELECT date(created_at, 'unixepoch') AS day, COUNT(*) AS count
       FROM tickets WHERE guild_id = ? AND created_at >= ?
       GROUP BY day ORDER BY day`,
    )
    .all(guildId, since) as StatsExtras["perDay"];

  const ratingBreakdown = db
    .prepare(
      `SELECT score, COUNT(*) AS count FROM ratings
       WHERE guild_id = ? AND created_at >= ?
       GROUP BY score ORDER BY score`,
    )
    .all(guildId, since) as StatsExtras["ratingBreakdown"];

  const comments = db
    .prepare(
      `SELECT ticket_id AS ticketId, score, comment, created_at AS createdAt
       FROM ratings
       WHERE guild_id = ? AND created_at >= ?
         AND comment IS NOT NULL AND trim(comment) != ''
       ORDER BY created_at DESC LIMIT 25`,
    )
    .all(guildId, since) as StatsExtras["comments"];

  return { perDay, ratingBreakdown, comments };
}

/** Flat rows for CSV export of closed tickets in the window. */
export function getStatsExportRows(
  db: DB,
  guildId: string,
  windowDays = 30,
): StatsExportRow[] {
  const since = Math.floor(Date.now() / 1000) - windowDays * 86400;
  return db
    .prepare(
      `SELECT t.number AS number,
              COALESCE(c.label, 'Uncategorized') AS category,
              t.opener_id AS openerId,
              t.created_at AS createdAt,
              t.claimed_at AS claimedAt,
              t.first_staff_msg_at AS firstStaffMsgAt,
              t.closed_at AS closedAt,
              t.closed_by AS closedBy,
              t.close_reason AS closeReason,
              r.score AS rating
       FROM tickets t
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN ratings r ON r.ticket_id = t.id
       WHERE t.guild_id = ? AND t.status = 'closed' AND t.closed_at >= ?
       ORDER BY t.closed_at DESC`,
    )
    .all(guildId, since) as StatsExportRow[];
}
