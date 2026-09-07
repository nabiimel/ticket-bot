// The bot keeps one "Robux Stock" embed in the stock channel and edits it in
// place on every sync; this stores its message id so it can be found again.
export const migration = {
  name: "017_reservations_stock_message",
  sql: /* sql */ `
ALTER TABLE guild_config ADD COLUMN reservations_stock_message_id TEXT;
`,
};
