import type { PanelStatRow } from "@ticketbot/shared";
import type { DB } from "../index.js";

/**
 * Per-(panel, category) counters. `clicks` = someone pressed the button / picked
 * the dropdown option; `opens` = that click produced a ticket.
 */

function bump(
  db: DB,
  panelId: number,
  categoryId: number,
  col: "clicks" | "opens",
) {
  db.prepare(
    `INSERT INTO panel_stats (panel_id, category_id, ${col})
     VALUES (?, ?, 1)
     ON CONFLICT(panel_id, category_id) DO UPDATE SET ${col} = ${col} + 1`,
  ).run(panelId, categoryId);
}

export function bumpClick(db: DB, panelId: number, categoryId: number): void {
  bump(db, panelId, categoryId, "clicks");
}

export function bumpOpen(db: DB, panelId: number, categoryId: number): void {
  bump(db, panelId, categoryId, "opens");
}

export function getPanelStats(db: DB, panelId: number): PanelStatRow[] {
  return db
    .prepare(
      `SELECT category_id, clicks, opens FROM panel_stats
       WHERE panel_id = ? ORDER BY clicks DESC`,
    )
    .all(panelId)
    .map((r: any) => ({
      categoryId: r.category_id,
      clicks: r.clicks,
      opens: r.opens,
    }));
}

/** Drop a category's row (e.g. it was removed from the panel). */
export function clearPanelCategory(
  db: DB,
  panelId: number,
  categoryId: number,
): void {
  db.prepare(
    `DELETE FROM panel_stats WHERE panel_id = ? AND category_id = ?`,
  ).run(panelId, categoryId);
}
