// Reservations: a lightweight fulfilment queue. Staff press "Reserve" in a
// ticket (or add a walk-in from the dashboard); each row is a buyer to hand
// their order to, checked off when done.
export const migration = {
  name: "013_reservations",
  sql: /* sql */ `
CREATE TABLE reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  ticket_id INTEGER,
  channel_id TEXT,
  buyer_user_id TEXT,
  buyer_tag TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  qty INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'open',
  added_by TEXT,
  added_at INTEGER NOT NULL DEFAULT 0,
  done_by TEXT,
  done_at INTEGER,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_reservations_guild_status
  ON reservations (guild_id, status, id DESC);
CREATE INDEX idx_reservations_ticket ON reservations (ticket_id);
`,
};
