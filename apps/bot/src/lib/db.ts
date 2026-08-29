import { openDb, type DB } from "@ticketbot/db";
import { config } from "../config.js";

let db: DB | null = null;

export function getDb(): DB {
  if (!db) db = openDb({ path: config.DATABASE_PATH });
  return db;
}
