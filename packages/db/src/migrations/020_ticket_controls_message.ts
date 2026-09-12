// Tracks the "Ticket controls" message so it can be deleted and resent to
// stay near the bottom of the channel (see keepControlsSticky) instead of
// scrolling out of view as the conversation grows.
export const migration = {
  name: "020_ticket_controls_message",
  sql: /* sql */ `
ALTER TABLE tickets ADD COLUMN controls_message_id TEXT;
`,
};
