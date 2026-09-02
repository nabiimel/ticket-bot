// Per-Discord-role dashboard access, so staff can use the console without
// Manage Server. Levels: console < editor < admin.
export const migration = {
  name: "011_dashboard_grants",
  sql: /* sql */ `
CREATE TABLE dashboard_grants (
  guild_id TEXT NOT NULL,
  role_id  TEXT NOT NULL,
  level    TEXT NOT NULL,
  PRIMARY KEY (guild_id, role_id)
);
`,
};
