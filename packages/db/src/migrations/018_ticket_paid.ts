// Lets staff mark a ticket paid/unpaid (e.g. a reroll reservation ticket).
// Marking it paid relocates the channel to a configured "paid" Discord
// category; unmarking moves it back to the ticket's usual category.
export const migration = {
  name: "018_ticket_paid",
  sql: /* sql */ `
ALTER TABLE tickets ADD COLUMN paid INTEGER NOT NULL DEFAULT 0;
ALTER TABLE guild_config ADD COLUMN paid_category_id TEXT;
`,
};
