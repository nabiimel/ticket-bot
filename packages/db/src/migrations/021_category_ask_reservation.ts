// Per-category toggle: ask "Is this a reservation?" before showing the
// intake form, so staff can tell reservation-intent tickets apart from
// general questions at a glance without changing the form itself.
export const migration = {
  name: "021_category_ask_reservation",
  sql: /* sql */ `
ALTER TABLE categories ADD COLUMN ask_reservation INTEGER NOT NULL DEFAULT 0;
`,
};
