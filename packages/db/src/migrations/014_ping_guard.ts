// Ping guard: warn a ticket opener who repeatedly @-mentions the configured
// seller (user or role) in a short window. Escalating warnings only — on the
// third strike the bot alerts admins in the log channel; it never punishes.
export const migration = {
  name: "014_ping_guard",
  sql: /* sql */ `
ALTER TABLE guild_config ADD COLUMN ping_guard_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE guild_config ADD COLUMN ping_guard_seller_id TEXT;
ALTER TABLE guild_config ADD COLUMN ping_guard_max_pings INTEGER NOT NULL DEFAULT 3;
ALTER TABLE guild_config ADD COLUMN ping_guard_window_secs INTEGER NOT NULL DEFAULT 60;
`,
};
