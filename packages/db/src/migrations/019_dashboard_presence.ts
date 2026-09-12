// Tracks who's currently viewing a guild's dashboard (heartbeat-based, like
// Google Docs' collaborator avatars) — one row per (guild, user), upserted
// on each heartbeat so the table stays small regardless of how long someone
// has been visiting.
export const migration = {
  name: "019_dashboard_presence",
  sql: /* sql */ `
CREATE TABLE IF NOT EXISTS dashboard_presence (
  guild_id      TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  name          TEXT NOT NULL,
  avatar_url    TEXT,
  last_seen_at  INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_dashboard_presence_guild
  ON dashboard_presence(guild_id, last_seen_at);
`,
};
