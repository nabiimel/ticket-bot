import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

// Load repo-root .env (so bot and dashboard share one file), then a local override.
loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv();

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),
  DEV_GUILD_ID: z.string().optional().default(""),
  DATABASE_PATH: z.string().default("./data/ticketbot.db"),
  DATA_DIR: z.string().default("./data"),
  INTERNAL_PORT: z.coerce.number().int().positive().default(8787),
  INTERNAL_WAKE_SECRET: z.string().default(""),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  // Optional Discord webhook that receives batched error-level log lines.
  LOG_WEBHOOK_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = {
  ...parsed.data,
  devGuildId: parsed.data.DEV_GUILD_ID || null,
};

export type Config = typeof config;
