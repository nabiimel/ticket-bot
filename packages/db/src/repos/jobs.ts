import type { JobRecord, JobStatus, JobType } from "@ticketbot/shared";
import type { DB } from "../index.js";

function map<P>(r: any): JobRecord<P> {
  let payload: P;
  try {
    payload = JSON.parse(r.payload_json) as P;
  } catch {
    payload = {} as P;
  }
  return {
    id: r.id,
    guildId: r.guild_id,
    type: r.type as JobType,
    payload,
    status: r.status as JobStatus,
    attempts: r.attempts,
    createdAt: r.created_at,
    processedAt: r.processed_at,
    error: r.error,
  };
}

export function enqueueJob(
  db: DB,
  guildId: string,
  type: JobType,
  payload: unknown,
): number {
  const payloadJson = JSON.stringify(payload ?? {});

  // Collapse rapid duplicates (e.g. spamming "publish"): reuse an identical
  // job that is still pending.
  const dup = db
    .prepare(
      `SELECT id FROM jobs
       WHERE guild_id = ? AND type = ? AND payload_json = ? AND status = 'pending'
       LIMIT 1`,
    )
    .get(guildId, type, payloadJson) as { id: number } | undefined;
  if (dup) return dup.id;

  const info = db
    .prepare(
      `INSERT INTO jobs (guild_id, type, payload_json, status, created_at)
       VALUES (?, ?, ?, 'pending', ?)`,
    )
    .run(guildId, type, payloadJson, Math.floor(Date.now() / 1000));
  return Number(info.lastInsertRowid);
}

/** Claim up to `limit` pending jobs, marking attempts. */
export function takePendingJobs(db: DB, limit = 10): JobRecord[] {
  const rows = db
    .prepare(`SELECT * FROM jobs WHERE status = 'pending' ORDER BY id LIMIT ?`)
    .all(limit);
  const bump = db.prepare(
    `UPDATE jobs SET attempts = attempts + 1 WHERE id = ?`,
  );
  for (const r of rows) bump.run((r as any).id);
  return rows.map((r) => map(r));
}

export function completeJob(db: DB, id: number): void {
  db.prepare(
    `UPDATE jobs SET status = 'done', processed_at = ?, error = NULL WHERE id = ?`,
  ).run(Math.floor(Date.now() / 1000), id);
}

export function failJob(db: DB, id: number, error: string): void {
  // Give up after 5 attempts, otherwise leave pending for retry.
  db.prepare(
    `UPDATE jobs
       SET status = CASE WHEN attempts >= 5 THEN 'error' ELSE 'pending' END,
           processed_at = ?, error = ?
     WHERE id = ?`,
  ).run(Math.floor(Date.now() / 1000), error, id);
}

export function listJobs(db: DB, guildId: string, limit = 50): JobRecord[] {
  return db
    .prepare(`SELECT * FROM jobs WHERE guild_id = ? ORDER BY id DESC LIMIT ?`)
    .all(guildId, limit)
    .map((r) => map(r));
}
