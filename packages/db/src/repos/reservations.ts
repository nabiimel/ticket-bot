import type { ReservationRecord, ReservationStatus } from "@ticketbot/shared";
import type { DB } from "../index.js";

function map(r: any): ReservationRecord {
  return {
    id: r.id,
    guildId: r.guild_id,
    ticketId: r.ticket_id ?? null,
    channelId: r.channel_id ?? null,
    buyerUserId: r.buyer_user_id ?? null,
    buyerTag: r.buyer_tag ?? "",
    gakuranName: r.gakuran_name ?? "",
    robloxUser: r.roblox_user ?? "",
    note: r.note ?? "",
    qty: r.qty ?? 0,
    paid: !!r.paid,
    status: (r.status ?? "open") as ReservationStatus,
    addedBy: r.added_by ?? null,
    addedAt: r.added_at ?? 0,
    doneBy: r.done_by ?? null,
    doneAt: r.done_at ?? null,
    updatedAt: r.updated_at ?? 0,
  };
}

const now = () => Math.floor(Date.now() / 1000);

export function listReservations(
  db: DB,
  guildId: string,
  opts: { status?: ReservationStatus; limit?: number } = {},
): ReservationRecord[] {
  const limit = Math.min(Math.max(opts.limit ?? 500, 1), 2000);
  const rows = opts.status
    ? db
        .prepare(
          `SELECT * FROM reservations
           WHERE guild_id = ? AND status = ?
           ORDER BY id DESC LIMIT ?`,
        )
        .all(guildId, opts.status, limit)
    : db
        .prepare(
          `SELECT * FROM reservations
           WHERE guild_id = ?
           ORDER BY id DESC LIMIT ?`,
        )
        .all(guildId, limit);
  return rows.map(map);
}

export function countOpen(db: DB, guildId: string): number {
  const r = db
    .prepare(
      `SELECT COUNT(*) AS n FROM reservations
       WHERE guild_id = ? AND status = 'open'`,
    )
    .get(guildId) as { n: number };
  return r?.n ?? 0;
}

/** Total rerolls across every non-cancelled reservation (for the budget line). */
export function sumRerolls(db: DB, guildId: string): number {
  const r = db
    .prepare(
      `SELECT COALESCE(SUM(qty), 0) AS n FROM reservations
       WHERE guild_id = ? AND status != 'cancelled'`,
    )
    .get(guildId) as { n: number };
  return r?.n ?? 0;
}

export function getReservation(db: DB, id: number): ReservationRecord | null {
  const r = db.prepare(`SELECT * FROM reservations WHERE id = ?`).get(id);
  return r ? map(r) : null;
}

/** The still-open reservation tied to a ticket, if any (used for de-dupe). */
export function getOpenForTicket(
  db: DB,
  ticketId: number,
): ReservationRecord | null {
  const r = db
    .prepare(
      `SELECT * FROM reservations
       WHERE ticket_id = ? AND status = 'open'
       ORDER BY id DESC LIMIT 1`,
    )
    .get(ticketId);
  return r ? map(r) : null;
}

const clampQty = (v: number | undefined) =>
  Math.min(Math.max(Math.trunc(v ?? 0) || 0, 0), 100000);

export function createReservation(
  db: DB,
  input: {
    guildId: string;
    ticketId?: number | null;
    channelId?: string | null;
    buyerUserId?: string | null;
    buyerTag: string;
    gakuranName?: string;
    robloxUser?: string;
    note?: string;
    qty?: number;
    paid?: boolean;
    addedBy?: string | null;
  },
): ReservationRecord {
  const ts = now();
  const info = db
    .prepare(
      `INSERT INTO reservations
         (guild_id, ticket_id, channel_id, buyer_user_id, buyer_tag,
          gakuran_name, roblox_user, note, qty, paid, status,
          added_by, added_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
    )
    .run(
      input.guildId,
      input.ticketId ?? null,
      input.channelId ?? null,
      input.buyerUserId ?? null,
      input.buyerTag,
      (input.gakuranName ?? "").slice(0, 120),
      (input.robloxUser ?? "").slice(0, 120),
      input.note ?? "",
      clampQty(input.qty),
      input.paid ? 1 : 0,
      input.addedBy ?? null,
      ts,
      ts,
    );
  return getReservation(db, Number(info.lastInsertRowid))!;
}

/** Move a row between open / done / cancelled. Stamps done_by/at on 'done'. */
export function setStatus(
  db: DB,
  id: number,
  status: ReservationStatus,
  byUserId: string | null,
): ReservationRecord | null {
  const ts = now();
  if (status === "done") {
    db.prepare(
      `UPDATE reservations
         SET status = 'done', done_by = ?, done_at = ?, updated_at = ?
       WHERE id = ?`,
    ).run(byUserId, ts, ts, id);
  } else {
    db.prepare(
      `UPDATE reservations
         SET status = ?, done_by = NULL, done_at = NULL, updated_at = ?
       WHERE id = ?`,
    ).run(status, ts, id);
  }
  return getReservation(db, id);
}

export function updateReservation(
  db: DB,
  id: number,
  patch: {
    note?: string;
    qty?: number;
    gakuranName?: string;
    robloxUser?: string;
    paid?: boolean;
  },
): ReservationRecord | null {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (patch.note !== undefined) {
    sets.push("note = ?");
    values.push(patch.note.slice(0, 500));
  }
  if (patch.qty !== undefined) {
    sets.push("qty = ?");
    values.push(clampQty(patch.qty));
  }
  if (patch.gakuranName !== undefined) {
    sets.push("gakuran_name = ?");
    values.push(patch.gakuranName.slice(0, 120));
  }
  if (patch.robloxUser !== undefined) {
    sets.push("roblox_user = ?");
    values.push(patch.robloxUser.slice(0, 120));
  }
  if (patch.paid !== undefined) {
    sets.push("paid = ?");
    values.push(patch.paid ? 1 : 0);
  }
  if (sets.length > 0) {
    sets.push("updated_at = ?");
    values.push(now(), id);
    db.prepare(`UPDATE reservations SET ${sets.join(", ")} WHERE id = ?`).run(
      ...values,
    );
  }
  return getReservation(db, id);
}

export function deleteReservation(db: DB, id: number): void {
  db.prepare(`DELETE FROM reservations WHERE id = ?`).run(id);
}
