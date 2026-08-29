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
}

export const logger = {
  debug: (...a: unknown[]) => emit("debug", a),
  info: (...a: unknown[]) => emit("info", a),
  warn: (...a: unknown[]) => emit("warn", a),
  error: (...a: unknown[]) => emit("error", a),
};
