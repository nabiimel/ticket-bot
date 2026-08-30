import type { RatingRecord } from "@ticketbot/shared";
import type { DB } from "../index.js";

function map(r: any): RatingRecord {
  return {
    ticketId: r.ticket_id,
    guildId: r.guild_id,
    userId: r.user_id,
    score: r.score,
    comment: r.comment,
    createdAt: r.created_at,
  };
}

export function upsertRating(
  db: DB,
  input: {
    ticketId: number;
    guildId: string;
    userId: string;
    score: number;
    comment?: string | null;
  },
): void {
  db.prepare(
    `INSERT INTO ratings (ticket_id, guild_id, user_id, score, comment, created_at)
     VALUES (@ticketId, @guildId, @userId, @score, @comment, @now)
     ON CONFLICT(ticket_id) DO UPDATE SET
       score = excluded.score,
       comment = COALESCE(excluded.comment, ratings.comment)`,
  ).run({
    ticketId: input.ticketId,
    guildId: input.guildId,
    userId: input.userId,
    score: input.score,
    comment: input.comment ?? null,
    now: Math.floor(Date.now() / 1000),
  });
}

export function getRating(db: DB, ticketId: number): RatingRecord | null {
  const row = db
    .prepare(`SELECT * FROM ratings WHERE ticket_id = ?`)
    .get(ticketId);
  return row ? map(row) : null;
}

/** Recent low-scoring ratings for the dashboard notification feed. */
export function listLowRatings(
  db: DB,
  guildId: string,
  atOrBelow: number,
  limit = 20,
): RatingRecord[] {
  return db
    .prepare(
      `SELECT * FROM ratings WHERE guild_id = ? AND score <= ?
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(guildId, atOrBelow, limit)
    .map(map);
}
