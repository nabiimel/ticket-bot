import type Database from "better-sqlite3";
import { MIGRATIONS } from "./migrations/index.js";

/**
 * Apply pending migrations in order. Migrations are bundled as TS modules (no
 * filesystem reads) so this works identically under tsx, Next, and any bundler.
 *
 * Idempotent: applied names are tracked in `_migrations`. The whole run is
 * serialized with BEGIN EXCLUSIVE so two processes starting at once can't both
 * migrate.
 */
export function runMigrations(db: Database.Database): string[] {
  db.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (
       name       TEXT PRIMARY KEY,
       applied_at INTEGER NOT NULL
     )`,
  );

  const ran: string[] = [];
  const insert = db.prepare(
    "INSERT INTO _migrations (name, applied_at) VALUES (?, ?)",
  );

  db.exec("BEGIN EXCLUSIVE");
  try {
    const applied = new Set<string>(
      db
        .prepare("SELECT name FROM _migrations")
        .all()
        .map((r) => (r as { name: string }).name),
    );
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.name)) continue;
      db.exec(migration.sql);
      insert.run(migration.name, Math.floor(Date.now() / 1000));
      ran.push(migration.name);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return ran;
}
