import { openDb } from "./index.js";

// Loads DATABASE_PATH from the process env. When run via `npm run migrate` from
// the repo root, set it inline or export it first.
const db = openDb({ migrate: false });
const { runMigrations } = await import("./migrate.js");
const ran = runMigrations(db);

if (ran.length === 0) {
  console.log("Database is up to date. No migrations to apply.");
} else {
  console.log(`Applied ${ran.length} migration(s):`);
  for (const name of ran) console.log(`  - ${name}`);
}
db.close();
