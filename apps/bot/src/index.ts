import type { Server } from "node:http";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import { closeDb } from "@ticketbot/db";
import { config } from "./config.js";
import { getDb } from "./lib/db.js";
import { logger, flushLogWebhook } from "./lib/logger.js";
import * as ready from "./events/ready.js";
import * as interactionCreate from "./events/interactionCreate.js";
import * as messageCreate from "./events/messageCreate.js";
import * as channelDelete from "./events/channelDelete.js";
import { guildCreate, guildDelete } from "./events/guilds.js";
import { processJobsNow, startJobsWorker, stopJobsWorker } from "./lib/jobs.js";
import { startInternalServer } from "./lib/internalServer.js";
import { startScheduler, stopScheduler } from "./lib/scheduler.js";
import { syncCommands } from "./lib/deploy.js";

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
let watchdog: NodeJS.Timeout | null = null;

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
  startWatchdog();
});

/**
 * Self-heal for a wedged gateway connection: `restart: unless-stopped` only
 * reacts to a process exit, not a silently-dead WebSocket. If the client stays
 * un-ready for three consecutive checks (~3 min) after having connected once,
 * exit non-zero and let Docker recycle the container.
 */
function startWatchdog(): void {
  let misses = 0;
  if (watchdog) clearInterval(watchdog);
  watchdog = setInterval(() => {
    if (client.isReady()) {
      misses = 0;
      return;
    }
    misses++;
    logger.warn(`watchdog: client not ready (${misses}/3)`);
    if (misses >= 3) {
      logger.error(
        "watchdog: client unready for 3 checks — exiting for restart",
      );
      process.exit(1);
    }
  }, 60_000);
  watchdog.unref();
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
    if (watchdog) clearInterval(watchdog);
    stopScheduler();
    stopJobsWorker();
    if (client.isReady()) await processJobsNow(client).catch(() => {});
    internalServer?.close();
    await client.destroy();
    await flushLogWebhook().catch(() => {});
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

await syncCommands();
await client.login(config.DISCORD_TOKEN);
