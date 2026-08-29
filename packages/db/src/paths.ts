import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

let cachedRoot: string | null = null;

/**
 * Walk up from `start` to the monorepo root (the directory that holds both
 * `package-lock.json` and an `apps/` folder). Falls back to `start`.
 *
 * Both the bot and the dashboard run from their own `apps/<name>` working
 * directory, so relative `DATABASE_PATH` / `DATA_DIR` values must be resolved
 * against this shared root — otherwise the two processes would use different
 * files.
 */
export function findRepoRoot(start: string = process.cwd()): string {
  if (cachedRoot) return cachedRoot;
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (
      existsSync(join(dir, "package-lock.json")) &&
      existsSync(join(dir, "apps"))
    ) {
      cachedRoot = dir;
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  cachedRoot = start;
  return start;
}

/** Resolve a possibly-relative path against the repo root (absolute paths pass through). */
export function resolveFromRoot(p: string): string {
  if (!p) return p;
  return isAbsolute(p) ? p : resolve(findRepoRoot(), p);
}

/** Absolute path to the shared data directory (`DATA_DIR`, default `./data`). */
export function dataDir(): string {
  return resolveFromRoot(process.env.DATA_DIR ?? "./data");
}

/** Absolute path to the transcripts directory (optionally a single ticket's file). */
export function transcriptsDir(ticketId?: number | string): string {
  const dir = join(dataDir(), "transcripts");
  return ticketId == null ? dir : join(dir, `${ticketId}.html`);
}

/** Absolute path to the uploads directory (optionally a guild's subfolder). */
export function uploadsDir(guildId?: string): string {
  const dir = join(dataDir(), "uploads");
  return guildId ? join(dir, guildId) : dir;
}
