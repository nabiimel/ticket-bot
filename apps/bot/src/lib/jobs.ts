import {
  ChannelType,
  type Client,
  type GuildTextBasedChannel,
  type TextChannel,
} from "discord.js";
import type {
  AdminCloseTicketPayload,
  EditPanelPayload,
  JobRecord,
  PostPreviewPayload,
  RepostPanelPayload,
  SyncTicketPermsPayload,
} from "@ticketbot/shared";
import { repos } from "@ticketbot/db";
import { getDb } from "./db.js";
import { bustConfigCache } from "./configCache.js";
import { buildContext } from "./context.js";
import { buildPanelComponents } from "./embeds.js";
import { buildEmbedWithAssets } from "./embedAssets.js";
import { buildTicketOverwrites, staffRoleIdsFor } from "./permissions.js";
import { closeTicket } from "./ticketManager.js";
import { logger } from "./logger.js";

let running = false;
let timer: NodeJS.Timeout | null = null;

async function textChannel(
  client: Client,
  guildId: string,
  channelId: string | null | undefined,
): Promise<TextChannel | null> {
  if (!channelId) return null;
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return null;
  const ch =
    guild.channels.cache.get(channelId) ??
    (await guild.channels.fetch(channelId).catch(() => null));
  return ch && ch.type === ChannelType.GuildText ? (ch as TextChannel) : null;
}

async function handleRepostOrEdit(
  client: Client,
  job: JobRecord<RepostPanelPayload | EditPanelPayload>,
) {
  const db = getDb();
  const panel = repos.panels.getPanel(db, job.payload.panelId);
  if (!panel) throw new Error(`panel ${job.payload.panelId} not found`);
  const guild = client.guilds.cache.get(panel.guildId);
  if (!guild) throw new Error(`guild ${panel.guildId} unavailable`);

  const categories = repos.categories.listCategories(db, panel.guildId);
  const { embed, files } = buildEmbedWithAssets(
    panel.embed,
    buildContext({ guild }),
  );
  const components = buildPanelComponents(panel, categories, guild.name);
  const channel = await textChannel(client, panel.guildId, panel.channelId);
  if (!channel) throw new Error("panel has no valid target channel");

  // Try to edit the existing message; fall back to posting a new one if it was
  // deleted, moved, or is only in the client cache.
  if (panel.messageId) {
    const existing = await channel.messages
      .fetch({ message: panel.messageId, force: true })
      .catch(() => null);
    if (existing) {
      try {
        // `attachments: []` clears any previously-attached image before re-adding.
        await existing.edit({
          embeds: [embed],
          components,
          files,
          attachments: [],
        });
        return;
      } catch (err) {
        logger.warn(
          `panel ${panel.id}: edit failed, posting a fresh message`,
          err,
        );
      }
    }
  }
  const msg = await channel.send({ embeds: [embed], components, files });
  repos.panels.setPanelMessage(db, panel.id, channel.id, msg.id);
}

async function handleSyncPerms(
  client: Client,
  job: JobRecord<SyncTicketPermsPayload>,
) {
  const db = getDb();
  const guild = client.guilds.cache.get(job.guildId);
  if (!guild) return;
  const guildConfig = repos.guildConfig.getGuildConfig(db, job.guildId);

  // A specific category, or every open ticket in the guild (default staff role changed).
  const tickets =
    job.payload.categoryId != null
      ? repos.tickets.listOpenTicketsByCategory(db, job.payload.categoryId)
      : repos.tickets.listOpenTickets(db, job.guildId);

  for (const ticket of tickets) {
    const ch =
      guild.channels.cache.get(ticket.channelId) ??
      (await guild.channels.fetch(ticket.channelId).catch(() => null));
    if (!ch || ch.type !== ChannelType.GuildText) continue;
    const category =
      ticket.categoryId != null
        ? repos.categories.getCategory(db, ticket.categoryId)
        : null;
    const staffRoleIds = staffRoleIdsFor(guildConfig, category);
    const members = repos.tickets.listMembers(db, ticket.id);
    await (ch as TextChannel).permissionOverwrites
      .set(buildTicketOverwrites(guild, ticket.openerId, staffRoleIds, members))
      .catch((err) => logger.error("sync perms failed", ticket.id, err));
  }
}

async function handlePreview(
  client: Client,
  job: JobRecord<PostPreviewPayload>,
) {
  const channel = await textChannel(client, job.guildId, job.payload.channelId);
  if (!channel) throw new Error("preview channel unavailable");
  const guild = client.guilds.cache.get(job.guildId)!;
  const { embed, files } = buildEmbedWithAssets(
    job.payload.embed,
    buildContext({ guild }),
  );
  await channel.send({ embeds: [embed], files });
}

async function handleAdminClose(
  client: Client,
  job: JobRecord<AdminCloseTicketPayload>,
) {
  const db = getDb();
  const ticket = repos.tickets.getTicket(db, job.payload.ticketId);
  if (!ticket || ticket.status === "closed") return;
  const guild = client.guilds.cache.get(ticket.guildId);
  if (!guild) return;
  const ch =
    guild.channels.cache.get(ticket.channelId) ??
    (await guild.channels.fetch(ticket.channelId).catch(() => null));
  if (!ch || !ch.isTextBased()) return;
  const closedBy = await client.users
    .fetch(job.payload.closedBy)
    .catch(() => client.user!);
  await closeTicket({
    guild,
    channel: ch as GuildTextBasedChannel,
    ticket,
    closedBy,
    reason: job.payload.reason ?? "Closed from dashboard",
    guildConfig: repos.guildConfig.getGuildConfig(db, ticket.guildId),
  });
}

async function processOne(client: Client, job: JobRecord): Promise<void> {
  switch (job.type) {
    case "repost_panel":
    case "edit_panel":
      await handleRepostOrEdit(client, job as JobRecord<RepostPanelPayload>);
      break;
    case "sync_ticket_perms":
      await handleSyncPerms(client, job as JobRecord<SyncTicketPermsPayload>);
      break;
    case "post_preview":
      await handlePreview(client, job as JobRecord<PostPreviewPayload>);
      break;
    case "admin_close_ticket":
      await handleAdminClose(client, job as JobRecord<AdminCloseTicketPayload>);
      break;
    default:
      logger.warn("unknown job type", job.type);
  }
}

/** Process all currently-pending jobs once. Safe to call concurrently (guarded). */
export async function processJobsNow(client: Client): Promise<number> {
  if (running) return 0;
  running = true;
  let handled = 0;
  try {
    const db = getDb();
    // loop until the queue drains (new jobs may be enqueued while we work)
    for (;;) {
      const batch = repos.jobs.takePendingJobs(db, 10);
      if (batch.length === 0) break;
      for (const job of batch) {
        try {
          if (repos.guildConfig.getGuildConfig(db, job.guildId).suspended) {
            repos.jobs.completeJob(db, job.id);
            logger.warn(
              `job ${job.id} skipped — guild ${job.guildId} suspended`,
            );
            continue;
          }
          await processOne(client, job);
          repos.jobs.completeJob(db, job.id);
          bustConfigCache(job.guildId);
          handled++;
        } catch (err) {
          logger.error(`job ${job.id} (${job.type}) failed`, err);
          repos.jobs.failJob(db, job.id, String(err));
        }
      }
    }
  } finally {
    running = false;
  }
  return handled;
}

export function startJobsWorker(client: Client, intervalMs = 3000): void {
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    void processJobsNow(client);
  }, intervalMs);
  void processJobsNow(client);
}

export function stopJobsWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
