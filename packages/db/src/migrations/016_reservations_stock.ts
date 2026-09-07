// Robux stock sync: an optional channel where the bot announces restocks, and
// a timestamp of the last push from the seller's balance pusher (Option A).
export const migration = {
  name: "016_reservations_stock",
  sql: /* sql */ `
ALTER TABLE guild_config ADD COLUMN reservations_stock_channel_id TEXT;
ALTER TABLE guild_config ADD COLUMN reservations_stock_synced_at INTEGER;
`,
};
