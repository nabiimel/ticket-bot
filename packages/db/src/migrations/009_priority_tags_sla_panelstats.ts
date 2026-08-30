// Ticket priority + free-form tags, per-guild SLA response targets, and
// per-panel click/open counters for the analytics card.
export const migration = {
  name: "009_priority_tags_sla_panelstats",
  sql: /* sql */ `
ALTER TABLE tickets ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE tickets ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';

ALTER TABLE guild_config ADD COLUMN sla_unclaimed_mins INTEGER NOT NULL DEFAULT 30;
ALTER TABLE guild_config ADD COLUMN sla_no_reply_mins INTEGER NOT NULL DEFAULT 60;

CREATE TABLE panel_stats (
  panel_id    INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  clicks      INTEGER NOT NULL DEFAULT 0,
  opens       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (panel_id, category_id)
);
`,
};
