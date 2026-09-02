// Live "Staff online / offline" line on panels, driven by per-weekday coverage
// hours in a chosen timezone, with a manual override.
export const migration = {
  name: "010_staff_status",
  sql: /* sql */ `
ALTER TABLE guild_config ADD COLUMN staff_status_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE guild_config ADD COLUMN staff_hours_json TEXT;
ALTER TABLE guild_config ADD COLUMN staff_status_override TEXT NOT NULL DEFAULT 'auto';
`,
};
