import "server-only";
import { openDb, repos, type DB } from "@ticketbot/db";

const globalForDb = globalThis as unknown as { __ticketbotDb?: DB };

export function db(): DB {
  if (!globalForDb.__ticketbotDb) {
    // Migrations are bundled and the runner is concurrency-safe (BEGIN EXCLUSIVE),
    // so it's fine for the dashboard to apply them too — this makes a first-run
    // `docker compose up` work without a separate migrate step.
    globalForDb.__ticketbotDb = openDb({ path: process.env.DATABASE_PATH });
  }
  return globalForDb.__ticketbotDb;
}

export { repos };
