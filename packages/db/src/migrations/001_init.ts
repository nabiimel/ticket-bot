// Initial schema for the Discord ticket bot + dashboard.
// All timestamps are unix seconds (INTEGER). JSON payloads are stored as TEXT.
export const migration = {
  name: "001_init",
  sql: /* sql */ `
CREATE TABLE IF NOT EXISTS guilds (
  guild_id   TEXT PRIMARY KEY,
  name       TEXT,
  icon       TEXT,
  added_at   INTEGER NOT NULL,
  removed_at INTEGER
);

CREATE TABLE IF NOT EXISTS guild_config (
  guild_id               TEXT PRIMARY KEY,
  log_channel_id         TEXT,
  transcript_channel_id  TEXT,
  default_staff_role_id  TEXT,
  language               TEXT NOT NULL DEFAULT 'en',
  naming_scheme          TEXT NOT NULL DEFAULT 'ticket-{number}',
  max_open_per_user      INTEGER NOT NULL DEFAULT 1,
  close_behaviour        TEXT NOT NULL DEFAULT 'delete',
  archive_category_id    TEXT,
  feedback_enabled       INTEGER NOT NULL DEFAULT 1,
  feedback_prompt_json   TEXT,
  welcome_embed_json     TEXT,
  close_embed_json       TEXT,
  inactivity_hours       INTEGER NOT NULL DEFAULT 0,
  updated_at             INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id            TEXT NOT NULL,
  key                 TEXT NOT NULL,
  label               TEXT NOT NULL,
  emoji               TEXT,
  description         TEXT,
  staff_role_ids_json TEXT NOT NULL DEFAULT '[]',
  ping_role_ids_json  TEXT NOT NULL DEFAULT '[]',
  discord_parent_id   TEXT,
  welcome_embed_json  TEXT,
  form_json           TEXT NOT NULL DEFAULT '[]',
  per_user_limit      INTEGER,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  UNIQUE (guild_id, key)
);
CREATE INDEX IF NOT EXISTS idx_categories_guild ON categories (guild_id);

CREATE TABLE IF NOT EXISTS panels (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id             TEXT NOT NULL,
  channel_id           TEXT,
  message_id           TEXT,
  style                TEXT NOT NULL DEFAULT 'buttons',
  dropdown_placeholder TEXT,
  embed_json           TEXT NOT NULL DEFAULT '{}',
  buttons_json         TEXT NOT NULL DEFAULT '{}',
  status               TEXT NOT NULL DEFAULT 'draft',
  created_by           TEXT,
  created_at           INTEGER NOT NULL DEFAULT 0,
  updated_at           INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_panels_guild ON panels (guild_id);

CREATE TABLE IF NOT EXISTS panel_categories (
  panel_id    INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (panel_id, category_id)
);

CREATE TABLE IF NOT EXISTS tickets (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id           TEXT NOT NULL,
  number             INTEGER NOT NULL,
  channel_id         TEXT NOT NULL,
  category_id        INTEGER,
  opener_id          TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'open',
  subject            TEXT,
  claimed_by         TEXT,
  created_at         INTEGER NOT NULL,
  claimed_at         INTEGER,
  first_staff_msg_at INTEGER,
  last_activity_at   INTEGER NOT NULL,
  closed_at          INTEGER,
  closed_by          TEXT,
  close_reason       TEXT,
  transcript_url     TEXT,
  UNIQUE (guild_id, number)
);
CREATE INDEX IF NOT EXISTS idx_tickets_guild_status ON tickets (guild_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_channel ON tickets (channel_id);
CREATE INDEX IF NOT EXISTS idx_tickets_opener ON tickets (guild_id, opener_id, status);

CREATE TABLE IF NOT EXISTS ticket_members (
  ticket_id INTEGER NOT NULL,
  user_id   TEXT NOT NULL,
  PRIMARY KEY (ticket_id, user_id)
);

CREATE TABLE IF NOT EXISTS ticket_form_responses (
  ticket_id   INTEGER NOT NULL,
  field_key   TEXT NOT NULL,
  field_label TEXT NOT NULL,
  value       TEXT NOT NULL,
  PRIMARY KEY (ticket_id, field_key)
);

CREATE TABLE IF NOT EXISTS blacklist (
  guild_id TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  reason   TEXT,
  added_by TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS ratings (
  ticket_id  INTEGER PRIMARY KEY,
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  score      INTEGER NOT NULL,
  comment    TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ratings_guild ON ratings (guild_id);

CREATE TABLE IF NOT EXISTS ticket_counter (
  guild_id    TEXT PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS jobs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id     TEXT NOT NULL,
  type         TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'pending',
  attempts     INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  processed_at INTEGER,
  error        TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status, id);
`,
};
