// Per-person breakdown for a reservation created from a multi-person order
// (see the personCount/personForm flow) — lets the Reservations and Tickets
// pages show one row per order while still exposing who's in it.
export const migration = {
  name: "023_reservation_breakdown",
  sql: /* sql */ `
ALTER TABLE reservations ADD COLUMN breakdown_json TEXT;
`,
};
