import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REST, Routes } from "discord.js";
import { dataDir } from "@ticketbot/db";
import { config } from "../config.js";
import { commands } from "../commands/index.js";
import { logger } from "./logger.js";

/** Stable fingerprint of the command definitions we would register. */
export function hashCommands(body: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

const hashFile = () => join(dataDir(), ".commands-hash");

function readHash(): string | null {
  try {
    return readFileSync(hashFile(), "utf8").trim() || null;
  } catch {
    return null;
  }
}

function writeHash(hash: string): void {
  try {
    mkdirSync(dataDir(), { recursive: true });
    writeFileSync(hashFile(), hash);
  } catch (err) {
    logger.warn("could not persist commands hash", err);
  }
}

/**
 * Register application (slash) commands.
 *
 * - **Global** commands are PUT only when their definition changed since the last
 *   sync (or `force` is set). Discord caps global command writes per day and the
 *   bot restarts on every deploy, so re-PUTing unconditionally is wasteful.
 * - When `DEV_GUILD_ID` is set that single guild is refreshed on **every** call:
 *   guild commands appear instantly, so the host server never waits on the ~1h
 *   global propagation delay.
 */
export async function syncCommands(
  opts: { force?: boolean } = {},
): Promise<void> {
  const body = commands.map((c) => c.data.toJSON());
  const hash = hashCommands(body);
  const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);

  if (config.devGuildId) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(
          config.DISCORD_CLIENT_ID,
          config.devGuildId,
        ),
        { body },
      );
      logger.info(
        `Registered ${body.length} command(s) to dev guild ${config.devGuildId}`,
      );
    } catch (err) {
      logger.warn("dev-guild command registration failed", err);
    }
  }

  if (!opts.force && readHash() === hash) {
    logger.info("Global commands unchanged — skipping global sync");
    return;
  }

  try {
    await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), {
      body,
    });
    writeHash(hash);
    logger.info(`Synced ${body.length} global command(s)`);
  } catch (err) {
    logger.error("global command registration failed", err);
  }
}
