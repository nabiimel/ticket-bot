import { existsSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "@ticketbot/db";
import ytdlpDefault from "yt-dlp-exec";

/**
 * yt-dlp-exec's CJS module attaches `.exec` to the default-exported function
 * at runtime (`fn.exec = ...` inside its own `create()`), but that assignment
 * isn't visible to Node's static CJS→ESM named-export analysis, so
 * `import { exec } from "yt-dlp-exec"` throws at load time under our ESM
 * bot even though it type-checks. Go through the default import instead,
 * which Node always supports for CJS interop.
 */
export interface YtDlpChildProcess extends Promise<{
  stdout: string;
  stderr: string;
}> {
  stdout: NodeJS.ReadableStream | null;
  stdin?: NodeJS.WritableStream | null;
  kill(signal?: string): boolean;
}

interface YtDlpModule {
  exec(url: string, flags?: Record<string, unknown>): YtDlpChildProcess;
}

const ytdlp = ytdlpDefault as unknown as YtDlpModule;

export const ytdlpExec = (
  url: string,
  flags?: Record<string, unknown>,
): YtDlpChildProcess => ytdlp.exec(url, flags);

const COOKIES_PATH = join(dataDir(), "cookies.txt");

/**
 * If an operator has dropped a `cookies.txt` (Netscape format, exported from
 * a logged-in browser) into the persistent data dir, use it — this is what
 * lets YouTube requests past its anonymous-IP bot-check. Absent by default;
 * everything falls back to working without it (see search.ts).
 */
export function hasYouTubeCookies(): boolean {
  return existsSync(COOKIES_PATH);
}

export function cookiesFlags(): Record<string, unknown> {
  return hasYouTubeCookies() ? { cookies: COOKIES_PATH } : {};
}
