import type {
  TicketPriority,
  TicketRecord,
  TicketStatus,
} from "@ticketbot/shared";
import type { DB } from "../index.js";

function parseTags(json: unknown): string[] {
  if (typeof json !== "string") return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export interface FormResponse {
  fieldKey: string;
  fieldLabel: string;
  value: string;
}

function map(r: any): TicketRecord {
  return {
    id: r.id,
    guildId: r.guild_id,
    number: r.number,
    channelId: r.channel_id,
    categoryId: r.category_id,
    openerId: r.opener_id,
    status: r.status as TicketStatus,
    priority: (r.priority ?? "normal") as TicketPriority,
    tags: parseTags(r.tags),
    subject: r.subject,
    claimedBy: r.claimed_by,
    createdAt: r.created_at,
    claimedAt: r.claimed_at,
    firstStaffMsgAt: r.first_staff_msg_at,
    lastActivityAt: r.last_activity_at,
    closedAt: r.closed_at,
    closedBy: r.closed_by,
    closeReason: r.close_reason,
    transcriptUrl: r.transcript_url,
  };
}

export interface CreateTicketInput {
  guildId: string;
  number: number;
  channelId: string;
  categoryId: number | null;
  openerId: string;
  subject?: string | null;
  formResponses?: FormResponse[];
}

export function createTicket(db: DB, input: CreateTicketInput): TicketRecord {
  const now = Math.floor(Date.now() / 1000);
  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO tickets
          (guild_id, number, channel_id, category_id, opener_id, status,
           subject, created_at, last_activity_at)
         VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
      )
      .run(
        input.guildId,
        input.number,
        input.channelId,
        input.categoryId,
        input.openerId,
        input.subject ?? null,
        now,
        now,
      );
    const id = Number(info.lastInsertRowid);
    if (input.formResponses?.length) {
      const insert = db.prepare(
        `INSERT INTO ticket_form_responses (ticket_id, field_key, field_label, value)
         VALUES (?, ?, ?, ?)`,
      );
      for (const fr of input.formResponses) {
        insert.run(id, fr.fieldKey, fr.fieldLabel, fr.value);
      }
    }
    return id;
  });
  const id = tx();
  return getTicket(db, id)!;
}

export function getTicket(db: DB, id: number): TicketRecord | null {
  const row = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(id);
  return row ? map(row) : null;
}

export function getTicketByChannel(
  db: DB,
  channelId: string,
): TicketRecord | null {
  const row = db
    .prepare(`SELECT * FROM tickets WHERE channel_id = ?`)
    .get(channelId);
  return row ? map(row) : null;
}

export function countOpenByUser(
  db: DB,
  guildId: string,
  openerId: string,
  categoryId?: number,
): number {
  const clause = categoryId != null ? `AND category_id = ?` : ``;
  const args: unknown[] = [guildId, openerId];
  if (categoryId != null) args.push(categoryId);
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM tickets
       WHERE guild_id = ? AND opener_id = ? AND status != 'closed' ${clause}`,
    )
    .get(...args) as { n: number };
  return row.n;
}

export function getFormResponses(db: DB, ticketId: number): FormResponse[] {
  return db
    .prepare(
      `SELECT field_key, field_label, value FROM ticket_form_responses WHERE ticket_id = ?`,
    )
    .all(ticketId)
    .map((r: any) => ({
      fieldKey: r.field_key,
      fieldLabel: r.field_label,
      value: r.value,
    }));
}

export function claimTicket(db: DB, id: number, staffId: string): void {
  db.prepare(
    `UPDATE tickets SET status = 'claimed', claimed_by = ?, claimed_at = ?
     WHERE id = ? AND status != 'closed'`,
  ).run(staffId, Math.floor(Date.now() / 1000), id);
}

export function markClosed(
  db: DB,
  id: number,
  closedBy: string,
  reason: string | null,
  transcriptUrl: string | null,
): void {
  db.prepare(
    `UPDATE tickets SET status = 'closed', closed_by = ?, close_reason = ?,
       transcript_url = ?, closed_at = ?
     WHERE id = ?`,
  ).run(closedBy, reason, transcriptUrl, Math.floor(Date.now() / 1000), id);
}

export function bumpActivity(
  db: DB,
  channelId: string,
  opts: { staff?: boolean } = {},
): void {
  const now = Math.floor(Date.now() / 1000);
  if (opts.staff) {
    db.prepare(
      `UPDATE tickets SET last_activity_at = ?,
         first_staff_msg_at = COALESCE(first_staff_msg_at, ?)
       WHERE channel_id = ? AND status != 'closed'`,
    ).run(now, now, channelId);
  } else {
    db.prepare(
      `UPDATE tickets SET last_activity_at = ? WHERE channel_id = ? AND status != 'closed'`,
    ).run(now, channelId);
  }
}

export function addMember(db: DB, ticketId: number, userId: string): void {
  db.prepare(
    `INSERT INTO ticket_members (ticket_id, user_id) VALUES (?, ?)
     ON CONFLICT DO NOTHING`,
  ).run(ticketId, userId);
}

export function removeMember(db: DB, ticketId: number, userId: string): void {
  db.prepare(
    `DELETE FROM ticket_members WHERE ticket_id = ? AND user_id = ?`,
  ).run(ticketId, userId);
}

export function listMembers(db: DB, ticketId: number): string[] {
  return db
    .prepare(`SELECT user_id FROM ticket_members WHERE ticket_id = ?`)
    .all(ticketId)
    .map((r: any) => r.user_id);
}

export function listOpenTickets(db: DB, guildId?: string): TicketRecord[] {
  const rows = guildId
    ? db
        .prepare(
          `SELECT * FROM tickets WHERE guild_id = ? AND status != 'closed'`,
        )
        .all(guildId)
    : db.prepare(`SELECT * FROM tickets WHERE status != 'closed'`).all();
  return rows.map(map);
}

export function listOpenTicketsByCategory(
  db: DB,
  categoryId: number,
): TicketRecord[] {
  return db
    .prepare(
      `SELECT * FROM tickets WHERE category_id = ? AND status != 'closed'`,
    )
    .all(categoryId)
    .map(map);
}

export function listClosedTickets(
  db: DB,
  guildId: string,
  limit = 100,
  offset = 0,
): TicketRecord[] {
  return db
    .prepare(
      `SELECT * FROM tickets WHERE guild_id = ? AND status = 'closed'
       ORDER BY closed_at DESC LIMIT ? OFFSET ?`,
    )
    .all(guildId, limit, offset)
    .map(map);
}

/** Most recently opened tickets in a guild, any status. For the activity feed. */
export function listRecentlyOpened(
  db: DB,
  guildId: string,
  limit = 15,
): TicketRecord[] {
  return db
    .prepare(
      `SELECT * FROM tickets WHERE guild_id = ?
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(guildId, limit)
    .map(map);
}

export function renameSubject(db: DB, id: number, subject: string): void {
  db.prepare(`UPDATE tickets SET subject = ? WHERE id = ?`).run(subject, id);
}

export function setPriority(
  db: DB,
  id: number,
  priority: TicketPriority,
): void {
  db.prepare(`UPDATE tickets SET priority = ? WHERE id = ?`).run(priority, id);
}

/** Replace a ticket's tag list (deduped, trimmed, lowercased, capped at 10). */
export function setTags(db: DB, id: number, tags: string[]): void {
  const clean = [
    ...new Set(
      tags
        .map((s) => s.trim().toLowerCase().slice(0, 30))
        .filter((s) => s.length > 0),
    ),
  ].slice(0, 10);
  db.prepare(`UPDATE tickets SET tags = ? WHERE id = ?`).run(
    JSON.stringify(clean),
    id,
  );
}

/** Close a ticket whose channel no longer exists (no transcript possible). */
export function markAbandoned(db: DB, id: number, reason: string): void {
  db.prepare(
    `UPDATE tickets SET status = 'closed', closed_by = NULL, close_reason = ?, closed_at = ?
     WHERE id = ? AND status != 'closed'`,
  ).run(reason, Math.floor(Date.now() / 1000), id);
}

/** Closed tickets whose transcript file is old enough to prune. */
export function listExpiredTranscripts(
  db: DB,
  guildId: string,
  olderThanUnix: number,
): { id: number }[] {
  return db
    .prepare(
      `SELECT id FROM tickets
       WHERE guild_id = ? AND status = 'closed'
         AND closed_at IS NOT NULL AND closed_at < ? AND transcript_url IS NOT NULL`,
    )
    .all(guildId, olderThanUnix) as { id: number }[];
}

export function clearTranscriptUrl(db: DB, id: number): void {
  db.prepare(`UPDATE tickets SET transcript_url = NULL WHERE id = ?`).run(id);
}
