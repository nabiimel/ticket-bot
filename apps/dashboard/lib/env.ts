import "server-only";
import { z } from "zod";

const schema = z.object({
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_BOT_TOKEN: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url().optional(),
  DATABASE_PATH: z.string().default("./data/ticketbot.db"),
  DATA_DIR: z.string().default("./data"),
  BOT_INTERNAL_URL: z.string().url().optional(),
  INTERNAL_WAKE_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

/**
 * Loose accessor — never throws, so `next build` (which only imports modules)
 * works without real secrets. Use `assertEnv()` for a hard runtime check.
 */
export const env: Env = schema.partial().parse(process.env) as Env;

let asserted = false;

/** Fail fast at server startup (called from instrumentation.ts). */
export function assertEnv(): void {
  if (asserted) return;
  if (process.env.SKIP_ENV_VALIDATION === "1") return;
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const lines = result.error.issues.map(
      (i) => `  - ${i.path.join(".")}: ${i.message}`,
    );
    throw new Error(
      `Invalid dashboard environment:\n${lines.join("\n")}\n` +
        `Set these in .env (repo root) or the container environment.`,
    );
  }
  asserted = true;
}
