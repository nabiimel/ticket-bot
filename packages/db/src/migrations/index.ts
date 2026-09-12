import { migration as m001 } from "./001_init.js";
import { migration as m002 } from "./002_extras.js";
import { migration as m003 } from "./003_claiming.js";
import { migration as m004 } from "./004_category_naming.js";
import { migration as m005 } from "./005_suspend.js";
import { migration as m006 } from "./006_snippets.js";
import { migration as m007 } from "./007_category_disabled.js";
import { migration as m008 } from "./008_notification_reads.js";
import { migration as m009 } from "./009_priority_tags_sla_panelstats.js";
import { migration as m010 } from "./010_staff_status.js";
import { migration as m011 } from "./011_dashboard_grants.js";
import { migration as m012 } from "./012_applications.js";
import { migration as m013 } from "./013_reservations.js";
import { migration as m014 } from "./014_ping_guard.js";
import { migration as m015 } from "./015_reservations_robux.js";
import { migration as m016 } from "./016_reservations_stock.js";
import { migration as m017 } from "./017_reservations_stock_message.js";
import { migration as m018 } from "./018_ticket_paid.js";
import { migration as m019 } from "./019_dashboard_presence.js";
import { migration as m020 } from "./020_ticket_controls_message.js";

export interface Migration {
  name: string;
  sql: string;
}

/** Ordered list of migrations. Append new ones; never reorder or edit applied SQL. */
export const MIGRATIONS: Migration[] = [
  m001,
  m002,
  m003,
  m004,
  m005,
  m006,
  m007,
  m008,
  m009,
  m010,
  m011,
  m012,
  m013,
  m014,
  m015,
  m016,
  m017,
  m018,
  m019,
  m020,
];
