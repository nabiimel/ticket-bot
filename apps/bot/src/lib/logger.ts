import { inspect } from "node:util";
import { config } from "../config.js";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

const threshold = LEVELS[config.LOG_LEVEL as Level] ?? LEVELS.info;

function emit(level: Level, args: unknown[]) {
  if (LEVELS[level] < threshold) return;
  const ts = new Date().toISOString();
  const fn =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.log;
  fn(`[${ts}] ${level.toUpperCase()}`, ...args);
  if (level === "error") queueWebhook(ts, args);
}

// ---------------------------------------------------------------------------
// Error → Discord webhook (batched). Entirely inert when LOG_WEBHOOK_URL unset.
// ---------------------------------------------------------------------------

const WEBHOOK = config.LOG_WEBHOOK_URL;
const MAX_BUFFER = 20;
const MIN_POST_GAP_MS = 10_000;
const FLUSH_INTERVAL_MS = 5_000;
const MAX_BODY = 1800;

let buffer: string[] = [];
let dropped = 0;
let lastPostAt = 0;
let flushTimer: NodeJS.Timeout | null = null;

function part(a: unknown): string {
  if (a instanceof Error) return a.stack ?? `${a.name}: ${a.message}`;
  if (typeof a === "string") return a;
  return inspect(a, { depth: 3, breakLength: 120 });
}

function queueWebhook(ts: string, args: unknown[]): void {
  if (!WEBHOOK) return;
  if (buffer.length >= MAX_BUFFER) {
    dropped++;
    return;
  }
  buffer.push(`[${ts}] ${args.map(part).join(" ")}`);
  if (!flushTimer) {
    flushTimer = setInterval(() => {
      void flushLogWebhook();
    }, FLUSH_INTERVAL_MS);
    flushTimer.unref();
  }
}

/** Post any buffered error lines to the webhook as a single message. */
export async function flushLogWebhook(): Promise<void> {
  if (!WEBHOOK || buffer.length === 0) return;
  if (Date.now() - lastPostAt < MIN_POST_GAP_MS) return;

  const lines = buffer;
  const extra = dropped;
  buffer = [];
  dropped = 0;
  lastPostAt = Date.now();

  let text = lines.join("\n");
  let overflow = extra;
  if (text.length > MAX_BODY) {
    text = text.slice(0, MAX_BODY);
    overflow += 1;
  }
  const suffix = overflow > 0 ? `\n(+${overflow} more)` : "";
  const content = `\`\`\`\n${text}${suffix}\n\`\`\``;

  try {
    await fetch(WEBHOOK, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content, username: "ticket-bot errors" }),
    });
  } catch (err) {
    // Never re-enter logger.error here — that would loop.
    console.error("[logger] webhook post failed", err);
  }
}

export const logger = {
  debug: (...a: unknown[]) => emit("debug", a),
  info: (...a: unknown[]) => emit("info", a),
  warn: (...a: unknown[]) => emit("warn", a),
  error: (...a: unknown[]) => emit("error", a),
};
