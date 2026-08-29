import type { Server } from "node:http";
import { Client, GatewayIntentBits, Partials, REST, Routes } from "discord.js";
import { closeDb } from "@ticketbot/db";
import { config } from "./config.js";
import { getDb } from "./lib/db.js";
import { logger } from "./lib/logger.js";
import { commands } from "./commands/index.js";
import * as ready from "./events/ready.js";
import * as interactionCreate from "./events/interactionCreate.js";
import * as messageCreate from "./events/messageCreate.js";
import * as channelDelete from "./events/channelDelete.js";
import { guildCreate, guildDelete } from "./events/guilds.js";
import { processJobsNow, startJobsWorker, stopJobsWorker } from "./lib/jobs.js";
import { startInternalServer } from "./lib/internalServer.js";
import { startScheduler, stopScheduler } from "./lib/scheduler.js";

getDb(); // open + migrate before we connect

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

let internalServer: Server | null = null;

client.once(ready.name, (c) => {
  void ready.execute(c);
});
client.on(interactionCreate.name, (i) => {
  void interactionCreate.execute(i);
});
client.on(messageCreate.name, (m) => {
  void messageCreate.execute(m);
});
client.on(channelDelete.name, (ch) => {
  void channelDelete.execute(ch);
});
client.on(guildCreate.name, (g) => guildCreate.execute(g));
client.on(guildDelete.name, (g) => guildDelete.execute(g));

client.once("ready", (c) => {
  startJobsWorker(c);
  internalServer = startInternalServer(c);
  startScheduler(c);
});

async function maybeAutoRegister(): Promise<void> {
  if (!config.devGuildId) return;
  try {
    const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);
    await rest.put(
      Routes.applicationGuildCommands(
        config.DISCORD_CLIENT_ID,
        config.devGuildId,
      ),
      { body: commands.map((c) => c.data.toJSON()) },
    );
    logger.info(`Auto-registered ${commands.length} commands to dev guild`);
  } catch (err) {
    logger.warn("dev-guild command auto-register failed", err);
  }
}

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received — shutting down`);

  // Force-exit if graceful shutdown stalls.
  const kill = setTimeout(() => process.exit(1), 10_000);
  kill.unref();

  try {
    stopScheduler();
    stopJobsWorker();
    if (client.isReady()) await processJobsNow(client).catch(() => {});
    internalServer?.close();
    await client.destroy();
    closeDb();
  } catch (err) {
    logger.error("error during shutdown", err);
  }
  process.exit(0);
}

process.on("unhandledRejection", (err) =>
  logger.error("unhandledRejection", err),
);
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await maybeAutoRegister();
await client.login(config.DISCORD_TOKEN);
