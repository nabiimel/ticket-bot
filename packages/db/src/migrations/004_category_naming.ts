// Optional per-category channel naming scheme (null = use the guild default).
export const migration = {
  name: "004_category_naming",
  sql: /* sql */ `
ALTER TABLE categories ADD COLUMN naming_scheme TEXT;
`,
};
