// Pause a ticket type without deleting it or unpublishing its panel.
export const migration = {
  name: "007_category_disabled",
  sql: /* sql */ `
ALTER TABLE categories ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN disabled_reason TEXT;
`,
};
