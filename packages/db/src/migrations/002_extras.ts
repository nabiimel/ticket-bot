// Transcript retention + config audit log.
export const migration = {
  name: "002_extras",
  sql: /* sql */ `
ALTER TABLE guild_config ADD COLUMN transcript_retention_days INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS config_audit (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id   TEXT NOT NULL,
  actor_id   TEXT NOT NULL,
  action     TEXT NOT NULL,
  summary    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_config_audit_guild ON config_audit (guild_id, id);
`,
};
