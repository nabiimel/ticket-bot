import type { Snippet } from "@ticketbot/shared";
import type { DB } from "../index.js";

function parseAttachments(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function map(r: any): Snippet {
  return {
    id: r.id,
    guildId: r.guild_id,
    name: r.name,
    content: r.content ?? "",
    attachments: parseAttachments(r.attachments_json),
    createdBy: r.created_by ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listSnippets(db: DB, guildId: string): Snippet[] {
  return db
    .prepare(`SELECT * FROM snippets WHERE guild_id = ? ORDER BY name`)
    .all(guildId)
    .map(map);
}

export function getSnippet(db: DB, id: number): Snippet | null {
  const row = db.prepare(`SELECT * FROM snippets WHERE id = ?`).get(id);
  return row ? map(row) : null;
}

export function getSnippetByName(
  db: DB,
  guildId: string,
  name: string,
): Snippet | null {
  const row = db
    .prepare(`SELECT * FROM snippets WHERE guild_id = ? AND name = ?`)
    .get(guildId, name);
  return row ? map(row) : null;
}

export function countSnippets(db: DB, guildId: string): number {
  return (
    db
      .prepare(`SELECT COUNT(*) AS n FROM snippets WHERE guild_id = ?`)
      .get(guildId) as { n: number }
  ).n;
}

export interface SnippetInput {
  name: string;
  content?: string;
  attachments?: string[];
  createdBy?: string | null;
}

export function createSnippet(
  db: DB,
  guildId: string,
  input: SnippetInput,
): Snippet {
  const now = Math.floor(Date.now() / 1000);
  const info = db
    .prepare(
      `INSERT INTO snippets
        (guild_id, name, content, attachments_json, created_by, created_at, updated_at)
       VALUES (@guild_id, @name, @content, @attachments, @created_by, @now, @now)`,
    )
    .run({
      guild_id: guildId,
      name: input.name,
      content: input.content ?? "",
      attachments: JSON.stringify(input.attachments ?? []),
      created_by: input.createdBy ?? null,
      now,
    });
  return getSnippet(db, Number(info.lastInsertRowid))!;
}

export function updateSnippet(
  db: DB,
  id: number,
  patch: Partial<Pick<SnippetInput, "name" | "content" | "attachments">>,
): Snippet | null {
  const cols: Record<string, string> = {
    name: "name",
    content: "content",
    attachments: "attachments_json",
  };
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, col] of Object.entries(cols)) {
    if (!(key in patch)) continue;
    const raw = (patch as Record<string, unknown>)[key];
    sets.push(`${col} = ?`);
    values.push(
      key === "attachments" ? JSON.stringify(raw ?? []) : (raw ?? ""),
    );
  }
  if (sets.length === 0) return getSnippet(db, id);
  sets.push("updated_at = ?");
  values.push(Math.floor(Date.now() / 1000));
  values.push(id);
  db.prepare(`UPDATE snippets SET ${sets.join(", ")} WHERE id = ?`).run(
    ...values,
  );
  return getSnippet(db, id);
}

export function deleteSnippet(db: DB, id: number): void {
  db.prepare(`DELETE FROM snippets WHERE id = ?`).run(id);
}
