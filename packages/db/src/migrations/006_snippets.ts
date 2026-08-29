// Canned responses ("snippets") staff can post into a ticket with /snippet.
export const migration = {
  name: "006_snippets",
  sql: /* sql */ `
CREATE TABLE snippets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id        TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  content         TEXT    NOT NULL DEFAULT '',
  attachments_json TEXT   NOT NULL DEFAULT '[]',
  created_by      TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  UNIQUE (guild_id, name)
);
CREATE INDEX idx_snippets_guild ON snippets (guild_id);
`,
};
