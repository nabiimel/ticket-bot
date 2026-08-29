import { migration as m001 } from "./001_init.js";
import { migration as m002 } from "./002_extras.js";
import { migration as m003 } from "./003_claiming.js";
import { migration as m004 } from "./004_category_naming.js";

export interface Migration {
  name: string;
  sql: string;
}

/** Ordered list of migrations. Append new ones; never reorder or edit applied SQL. */
export const MIGRATIONS: Migration[] = [m001, m002, m003, m004];
