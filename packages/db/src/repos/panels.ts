import {
  DEFAULT_PANEL_EMBED,
  type ButtonConfig,
  type EmbedConfig,
  type PanelConfig,
  type PanelStatus,
  type PanelStyle,
} from "@ticketbot/shared";
import type { DB } from "../index.js";

function map(db: DB, r: any): PanelConfig {
  const categoryIds = db
    .prepare(
      `SELECT category_id FROM panel_categories WHERE panel_id = ? ORDER BY sort_order`,
    )
    .all(r.id)
    .map((x) => (x as { category_id: number }).category_id);

  let embed: EmbedConfig = DEFAULT_PANEL_EMBED;
  try {
    const parsed = JSON.parse(r.embed_json);
    if (parsed && typeof parsed === "object") embed = parsed as EmbedConfig;
  } catch {
    /* keep default */
  }

  let buttons: Record<string, ButtonConfig> = {};
  try {
    const parsed = JSON.parse(r.buttons_json);
    if (parsed && typeof parsed === "object") buttons = parsed;
  } catch {
    /* keep empty */
  }

  return {
    id: r.id,
    guildId: r.guild_id,
    channelId: r.channel_id,
    messageId: r.message_id,
    style: (r.style ?? "buttons") as PanelStyle,
    dropdownPlaceholder: r.dropdown_placeholder,
    embed,
    buttons,
    categoryIds,
    status: (r.status ?? "draft") as PanelStatus,
    createdBy: r.created_by,
  };
}

export function listPanels(db: DB, guildId: string): PanelConfig[] {
  return db
    .prepare(`SELECT * FROM panels WHERE guild_id = ? ORDER BY id`)
    .all(guildId)
    .map((r) => map(db, r));
}

export function getPanel(db: DB, id: number): PanelConfig | null {
  const row = db.prepare(`SELECT * FROM panels WHERE id = ?`).get(id);
  return row ? map(db, row) : null;
}

export interface PanelInput {
  channelId?: string | null;
  style?: PanelStyle;
  dropdownPlaceholder?: string | null;
  embed?: EmbedConfig;
  buttons?: Record<string, ButtonConfig>;
  categoryIds?: number[];
  status?: PanelStatus;
  createdBy?: string | null;
}

export function createPanel(
  db: DB,
  guildId: string,
  input: PanelInput,
): PanelConfig {
  const now = Math.floor(Date.now() / 1000);
  const info = db
    .prepare(
      `INSERT INTO panels
        (guild_id, channel_id, style, dropdown_placeholder, embed_json,
         buttons_json, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      guildId,
      input.channelId ?? null,
      input.style ?? "buttons",
      input.dropdownPlaceholder ?? null,
      JSON.stringify(input.embed ?? DEFAULT_PANEL_EMBED),
      JSON.stringify(input.buttons ?? {}),
      input.status ?? "draft",
      input.createdBy ?? null,
      now,
      now,
    );
  const id = Number(info.lastInsertRowid);
  if (input.categoryIds) setPanelCategories(db, id, input.categoryIds);
  return getPanel(db, id)!;
}

export function updatePanel(
  db: DB,
  id: number,
  patch: PanelInput,
): PanelConfig | null {
  const cols: Record<string, string> = {
    channelId: "channel_id",
    style: "style",
    dropdownPlaceholder: "dropdown_placeholder",
    embed: "embed_json",
    buttons: "buttons_json",
    status: "status",
  };
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, col] of Object.entries(cols)) {
    if (!(key in patch)) continue;
    const raw = (patch as Record<string, unknown>)[key];
    let value: unknown = raw;
    if (key === "embed" || key === "buttons") value = JSON.stringify(raw ?? {});
    sets.push(`${col} = ?`);
    values.push(value ?? null);
  }
  if (sets.length > 0) {
    sets.push("updated_at = ?");
    values.push(Math.floor(Date.now() / 1000));
    values.push(id);
    db.prepare(`UPDATE panels SET ${sets.join(", ")} WHERE id = ?`).run(
      ...values,
    );
  }
  if (patch.categoryIds) setPanelCategories(db, id, patch.categoryIds);
  return getPanel(db, id);
}

export function setPanelMessage(
  db: DB,
  id: number,
  channelId: string,
  messageId: string,
): void {
  db.prepare(
    `UPDATE panels SET channel_id = ?, message_id = ?, updated_at = ? WHERE id = ?`,
  ).run(channelId, messageId, Math.floor(Date.now() / 1000), id);
}

export function setPanelCategories(
  db: DB,
  panelId: number,
  categoryIds: number[],
): void {
  const tx = db.transaction((ids: number[]) => {
    db.prepare(`DELETE FROM panel_categories WHERE panel_id = ?`).run(panelId);
    const insert = db.prepare(
      `INSERT INTO panel_categories (panel_id, category_id, sort_order) VALUES (?, ?, ?)`,
    );
    ids.forEach((cid, i) => insert.run(panelId, cid, i));
  });
  tx(categoryIds);
}

export function deletePanel(db: DB, id: number): void {
  db.prepare(`DELETE FROM panels WHERE id = ?`).run(id);
  db.prepare(`DELETE FROM panel_categories WHERE panel_id = ?`).run(id);
}
