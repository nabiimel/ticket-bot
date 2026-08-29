// Per-guild suspend switch for the bot host to cut off an abusive tenant.
export const migration = {
  name: "005_suspend",
  sql: /* sql */ `
ALTER TABLE guild_config ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0;
`,
};
