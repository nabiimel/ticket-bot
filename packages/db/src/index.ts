import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { runMigrations } from "./migrate.js";
import { resolveFromRoot } from "./paths.js";

export type DB = Database.Database;

let instance: DB | null = null;
let instancePath: string | null = null;

export interface OpenDbOptions {
  /** Overrides `process.env.DATABASE_PATH`. */
  path?: string;
  /** Run pending migrations on open. Default true. */
  migrate?: boolean;
}

function resolveDbPath(explicit?: string): string {
  const p = explicit ?? process.env.DATABASE_PATH ?? "./data/ticketbot.db";
  return resolveFromRoot(p);
}

/**
 * Open (or reuse) the shared SQLite connection. Both the bot and the dashboard
 * call this against the same file. WAL mode lets the two processes read/write
 * concurrently.
 */
export function openDb(opts: OpenDbOptions = {}): DB {
  const path = resolveDbPath(opts.path);

  if (instance && instancePath === path) return instance;
  if (instance && instancePath !== path) {
    instance.close();
    instance = null;
  }

  mkdirSync(dirname(path), { recursive: true });

  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");

  if (opts.migrate !== false) {
    runMigrations(db);
  }

  instance = db;
  instancePath = path;
  return db;
}

/** Close the shared connection (tests / graceful shutdown). */
export function closeDb(): void {
  if (instance) {
    instance.close();
    instance = null;
    instancePath = null;
  }
}

export { runMigrations } from "./migrate.js";
export * from "./paths.js";
export * as repos from "./repos/index.js";
