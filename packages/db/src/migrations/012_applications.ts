// Applications: a panel type that collects a form and routes it to reviewers
// for approve / deny, with automatic role granting on approval.
export const migration = {
  name: "012_applications",
  sql: /* sql */ `
CREATE TABLE applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  channel_id TEXT,
  message_id TEXT,
  embed_json TEXT NOT NULL,
  button_label TEXT NOT NULL DEFAULT 'Apply',
  questions_json TEXT NOT NULL DEFAULT '[]',
  reviewer_role_ids_json TEXT NOT NULL DEFAULT '[]',
  grant_role_ids_json TEXT NOT NULL DEFAULT '[]',
  log_channel_id TEXT,
  eligibility_json TEXT,
  max_open_per_user INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE application_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewer_id TEXT,
  reason TEXT,
  card_channel_id TEXT,
  card_message_id TEXT,
  decided_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_app_sub_app ON application_submissions (application_id, id DESC);
CREATE INDEX idx_app_sub_guild ON application_submissions (guild_id, status, id DESC);
`,
};
