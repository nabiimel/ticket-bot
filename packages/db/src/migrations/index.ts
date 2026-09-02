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
];
