// Per-category text overrides for the "is this a reservation?" prompt
// (title/body/button labels) added in 021 — unset fields fall back to the
// shared defaults, so this stores only what staff actually customized.
export const migration = {
  name: "022_category_reservation_prompt",
  sql: /* sql */ `
ALTER TABLE categories ADD COLUMN reservation_prompt_json TEXT;
`,
};
