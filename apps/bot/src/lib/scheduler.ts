import { mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  ChannelType,
  type Client,
  type GuildTextBasedChannel,
} from "discord.js";
import { dataDir, repos, transcriptsDir } from "@ticketbot/db";
import { getDb } from "./db.js";
import { closeTicket } from "./ticketManager.js";
import { logger } from "./logger.js";

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const SNAPSHOT_KEEP = 48;
/** Warn once when idle past the threshold; close on the next sweep if still idle. */
const warned = new Map<number, number>();
let timer: NodeJS.Timeout | null = null;

async function sweepInactivity(client: Client, now: number): Promise<void> {
  const db = getDb();
  for (const [, guild] of client.guilds.cache) {
    const cfg = repos.guildConfig.getGuildConfig(db, guild.id);
    if (cfg.suspended) continue;
    if (!cfg.inactivityHours || cfg.inactivityHours <= 0) continue;
    const cutoff = now - cfg.inactivityHours * 3600;

    for (const ticket of repos.tickets.listOpenTickets(db, guild.id)) {
      if (ticket.lastActivityAt > cutoff) {
        warned.delete(ticket.id);
        continue;
      }
      const ch =
        guild.channels.cache.get(ticket.channelId) ??
        (await guild.channels.fetch(ticket.channelId).catch(() => null));
      if (!ch || ch.type !== ChannelType.GuildText) continue;

      if (!warned.has(ticket.id)) {
        warned.set(ticket.id, now);
        await ch
          .send({
            content:
              `This ticket has been inactive for ${cfg.inactivityHours}h and will be ` +
              `closed automatically if there is no further activity.`,
          })
          .catch(() => null);
        continue;
      }

      try {
        await closeTicket({
          guild,
          channel: ch as GuildTextBasedChannel,
          ticket,
          closedBy: client.user!,
          reason: `Auto-closed after ${cfg.inactivityHours}h of inactivity`,
          guildConfig: cfg,
        });
      } catch (err) {
        logger.error("auto-close failed", ticket.id, err);
      }
      warned.delete(ticket.id);
    }
  }
}

async function sweepTranscripts(client: Client, now: number): Promise<void> {
  const db = getDb();
  let pruned = 0;
  for (const [, guild] of client.guilds.cache) {
    const cfg = repos.guildConfig.getGuildConfig(db, guild.id);
    if (cfg.suspended) continue;
    if (!cfg.transcriptRetentionDays || cfg.transcriptRetentionDays <= 0)
      continue;
    const cutoff = now - cfg.transcriptRetentionDays * 86400;
    for (const { id } of repos.tickets.listExpiredTranscripts(
      db,
      guild.id,
      cutoff,
    )) {
      await rm(transcriptsDir(id), { force: true }).catch(() => {});
      repos.tickets.clearTranscriptUrl(db, id);
      pruned++;
    }
  }
  if (pruned > 0) logger.info(`Pruned ${pruned} expired transcript file(s)`);
}

/** Hourly consistent DB snapshot for point-in-time recovery. Keeps newest 48. */
async function sweepSnapshots(): Promise<void> {
  const dir = join(dataDir(), "snapshots");
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}`;
  const target = join(dir, `db-${stamp}.db`);
  if (existsSync(target)) return; // already snapshotted this hour

  await mkdir(dir, { recursive: true });
  await getDb().backup(target);

  const files = (await readdir(dir))
    .filter((f) => /^db-\d{8}-\d{2}\.db$/.test(f))
    .sort();
  for (const f of files.slice(0, Math.max(0, files.length - SNAPSHOT_KEEP))) {
    await rm(join(dir, f), { force: true }).catch(() => {});
  }
  logger.info(`DB snapshot written: ${target}`);
}

async function sweep(client: Client): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await sweepInactivity(client, now).catch((e) =>
    logger.error("inactivity sweep", e),
  );
  await sweepTranscripts(client, now).catch((e) =>
    logger.error("transcript sweep", e),
  );
  await sweepSnapshots().catch((e) => logger.error("snapshot sweep", e));
}

export function startScheduler(client: Client): void {
  if (timer) clearInterval(timer);
  timer = setInterval(() => void sweep(client), CHECK_INTERVAL_MS);
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
