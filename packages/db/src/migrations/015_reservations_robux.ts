// Reservations rework: track the seller's Robux budget and price each row by
// reroll count. Also capture the buyer's Roblox + Gakuran name and a paid flag.
export const migration = {
  name: "015_reservations_robux",
  sql: /* sql */ `
ALTER TABLE reservations ADD COLUMN gakuran_name TEXT NOT NULL DEFAULT '';
ALTER TABLE reservations ADD COLUMN roblox_user TEXT NOT NULL DEFAULT '';
ALTER TABLE reservations ADD COLUMN paid INTEGER NOT NULL DEFAULT 0;

ALTER TABLE guild_config ADD COLUMN reservations_robux_budget INTEGER NOT NULL DEFAULT 0;
ALTER TABLE guild_config ADD COLUMN reservations_reroll_unit INTEGER NOT NULL DEFAULT 50;
ALTER TABLE guild_config ADD COLUMN reservations_robux_per_unit INTEGER NOT NULL DEFAULT 150;
ALTER TABLE guild_config ADD COLUMN reservations_discount_pct INTEGER NOT NULL DEFAULT 20;
`,
};
