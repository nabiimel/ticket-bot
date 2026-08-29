import type { CategoryConfig, EmbedConfig, FormField } from "@ticketbot/shared";
import type { DB } from "../index.js";

function jsonArray<T>(json: string | null, fallback: T[]): T[] {
  if (!json) return fallback;
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function map(r: any): CategoryConfig {
  return {
    id: r.id,
    guildId: r.guild_id,
    key: r.key,
    label: r.label,
    emoji: r.emoji,
    description: r.description,
    staffRoleIds: jsonArray<string>(r.staff_role_ids_json, []),
    pingRoleIds: jsonArray<string>(r.ping_role_ids_json, []),
    discordParentId: r.discord_parent_id,
    welcomeEmbed: r.welcome_embed_json
      ? (JSON.parse(r.welcome_embed_json) as EmbedConfig)
      : null,
    form: jsonArray<FormField>(r.form_json, []),
    perUserLimit: r.per_user_limit,
    namingScheme: r.naming_scheme ?? null,
    sortOrder: r.sort_order,
  };
}

export function listCategories(db: DB, guildId: string): CategoryConfig[] {
  return db
    .prepare(
      `SELECT * FROM categories WHERE guild_id = ? ORDER BY sort_order, label`,
    )
    .all(guildId)
    .map(map);
}

export function getCategory(db: DB, id: number): CategoryConfig | null {
  const row = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(id);
  return row ? map(row) : null;
}

export function getCategoryByKey(
  db: DB,
  guildId: string,
  key: string,
): CategoryConfig | null {
  const row = db
    .prepare(`SELECT * FROM categories WHERE guild_id = ? AND key = ?`)
    .get(guildId, key);
  return row ? map(row) : null;
}

export interface CategoryInput {
  key: string;
  label: string;
  emoji?: string | null;
  description?: string | null;
  staffRoleIds?: string[];
  pingRoleIds?: string[];
  discordParentId?: string | null;
  welcomeEmbed?: EmbedConfig | null;
  form?: FormField[];
  perUserLimit?: number | null;
  namingScheme?: string | null;
  sortOrder?: number;
}

export function createCategory(
  db: DB,
  guildId: string,
  input: CategoryInput,
): CategoryConfig {
  const info = db
    .prepare(
      `INSERT INTO categories
        (guild_id, key, label, emoji, description, staff_role_ids_json,
         ping_role_ids_json, discord_parent_id, welcome_embed_json, form_json,
         per_user_limit, naming_scheme, sort_order)
       VALUES (@guild_id, @key, @label, @emoji, @description, @staff, @ping,
               @parent, @welcome, @form, @limit, @naming, @sort)`,
    )
    .run({
      guild_id: guildId,
      key: input.key,
      label: input.label,
      emoji: input.emoji ?? null,
      description: input.description ?? null,
      staff: JSON.stringify(input.staffRoleIds ?? []),
      ping: JSON.stringify(input.pingRoleIds ?? []),
      parent: input.discordParentId ?? null,
      welcome: input.welcomeEmbed ? JSON.stringify(input.welcomeEmbed) : null,
      form: JSON.stringify(input.form ?? []),
      limit: input.perUserLimit ?? null,
      naming: input.namingScheme ?? null,
      sort: input.sortOrder ?? 0,
    });
  return getCategory(db, Number(info.lastInsertRowid))!;
}

export function updateCategory(
  db: DB,
  id: number,
  patch: Partial<CategoryInput>,
): CategoryConfig | null {
  const cols: Record<string, string> = {
    key: "key",
    label: "label",
    emoji: "emoji",
    description: "description",
    staffRoleIds: "staff_role_ids_json",
    pingRoleIds: "ping_role_ids_json",
    discordParentId: "discord_parent_id",
    welcomeEmbed: "welcome_embed_json",
    form: "form_json",
    perUserLimit: "per_user_limit",
    namingScheme: "naming_scheme",
    sortOrder: "sort_order",
  };
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, col] of Object.entries(cols)) {
    if (!(key in patch)) continue;
    const raw = (patch as Record<string, unknown>)[key];
    let value: unknown = raw;
    if (key === "staffRoleIds" || key === "pingRoleIds" || key === "form") {
      value = JSON.stringify(raw ?? []);
    } else if (key === "welcomeEmbed") {
      value = raw == null ? null : JSON.stringify(raw);
    }
    sets.push(`${col} = ?`);
    values.push(value ?? null);
  }
  if (sets.length === 0) return getCategory(db, id);
  values.push(id);
  db.prepare(`UPDATE categories SET ${sets.join(", ")} WHERE id = ?`).run(
    ...values,
  );
  return getCategory(db, id);
}

export function deleteCategory(db: DB, id: number): void {
  db.prepare(`DELETE FROM categories WHERE id = ?`).run(id);
  db.prepare(`DELETE FROM panel_categories WHERE category_id = ?`).run(id);
}

/** Persist a new display order; `orderedIds` is the desired top-to-bottom order. */
export function reorderCategories(
  db: DB,
  guildId: string,
  orderedIds: number[],
): void {
  const tx = db.transaction((ids: number[]) => {
    const upd = db.prepare(
      `UPDATE categories SET sort_order = ? WHERE id = ? AND guild_id = ?`,
    );
    ids.forEach((id, i) => upd.run(i, id, guildId));
  });
  tx(orderedIds);
}
