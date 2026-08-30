// Per-dashboard-user "notifications seen up to here" marker. The notification
// feed itself is derived on read from tickets / ratings / jobs / audit, so all
// we persist is a per-user high-water mark for the unread badge.
export const migration = {
  name: "008_notification_reads",
  sql: /* sql */ `
CREATE TABLE notification_reads (
  guild_id     TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  last_seen_at INTEGER NOT NULL DEFAULT 0,
  updated_at   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);
`,
};
