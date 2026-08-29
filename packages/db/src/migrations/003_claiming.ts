// Toggle for the "claim ticket" feature.
export const migration = {
  name: "003_claiming",
  sql: /* sql */ `
ALTER TABLE guild_config ADD COLUMN claiming_enabled INTEGER NOT NULL DEFAULT 1;
`,
};
