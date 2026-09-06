import {
  ChannelType,
  PermissionFlagsBits,
  type Client,
  type GuildTextBasedChannel,
  type TextChannel,
} from "discord.js";
import { t } from "@ticketbot/shared";
import type {
  AdminClaimTicketPayload,
  AdminCloseTicketPayload,
  DecideApplicationPayload,
  EditPanelPayload,
  JobRecord,
  PostPreviewPayload,
  RepostApplicationPayload,
  RepostPanelPayload,
  ReservationDonePayload,
  SyncTicketPermsPayload,
} from "@ticketbot/shared";
import { repos } from "@ticketbot/db";
import { getDb } from "./db.js";
import { bustConfigCache } from "./configCache.js";
import { buildContext } from "./context.js";
import { buildPanelComponents, buildTicketControls } from "./embeds.js";
import { buildEmbedWithAssets } from "./embedAssets.js";
import { buildTicketOverwrites, staffRoleIdsFor } from "./permissions.js";
import { closeTicket } from "./ticketManager.js";
import { computeStaffStatus, staffStatusLine } from "./staffStatus.js";
import { applyDecision, buildApplicationMessage } from "./applications.js";
import { alertAdmins } from "./preflight.js";
import { logger } from "./logger.js";

/** Thrown for panel/config problems an admin has to fix — no point retrying. */
class UnrecoverableJobError extends Error {}

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

/**
 * Resolve a panel's target channel, classifying why it failed so the caller can
 * tell "an admin must fix this" (stop retrying, drop the panel to draft) apart
 * from "might be transient / a permission they can grant" (keep retrying).
 */
async function resolvePanelChannel(
  client: Client,
  guildId: string,
  channelId: string | null | undefined,
): Promise<TextChannel> {
  if (!channelId) {
    throw new UnrecoverableJobError(
      "no channel is selected for it. Open the panel in the dashboard, pick a channel, and publish again.",
    );
  }
  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error(`guild ${guildId} unavailable`);

  const cached = guild.channels.cache.get(channelId);
  if (cached) {
    if (cached.type !== ChannelType.GuildText) {
      throw new UnrecoverableJobError(
        `its target channel (${cached}) isn't a text channel. Point the panel at a normal text channel and publish again.`,
      );
    }
    return cached as TextChannel;
  }

  try {
    const fetched = await guild.channels.fetch(channelId);
    if (!fetched) {
      throw new UnrecoverableJobError(
        "its target channel no longer exists. Pick a new channel in the dashboard and publish again.",
      );
    }
    if (fetched.type !== ChannelType.GuildText) {
      throw new UnrecoverableJobError(
        `its target channel (${fetched}) isn't a text channel. Point the panel at a normal text channel and publish again.`,
      );
    }
    return fetched as TextChannel;
  } catch (err) {
    if (err instanceof UnrecoverableJobError) throw err;
    const code = (err as { code?: number }).code;
    // 10003 Unknown Channel — it was deleted.
    if (code === 10003) {
      throw new UnrecoverableJobError(
        "its target channel was deleted. Pick a new channel in the dashboard and publish again.",
      );
    }
    // 50001 Missing Access — the channel exists but the bot can't see it. This
    // is fixable by granting a permission, so let it retry.
    if (code === 50001) {
      throw new Error(
        "the bot can't see its target channel. Give the bot the View Channel permission there, then re-post the panel.",
      );
    }
    throw err;
  }
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
  const cfg = repos.guildConfig.getGuildConfig(db, panel.guildId);
  const statusLine = staffStatusLine(computeStaffStatus(cfg));

  const panelName = panel.embed.title
    ? `“${panel.embed.title}”`
    : `Panel #${panel.id}`;

  let channel: TextChannel;
  try {
    channel = await resolvePanelChannel(client, panel.guildId, panel.channelId);
  } catch (err) {
    if (err instanceof UnrecoverableJobError) {
      // Stop the panel from re-queuing this forever, and tell the admins once.
      repos.panels.updatePanel(db, panel.id, { status: "draft" });
      await alertAdmins(
        guild,
        cfg,
        `${panelName} couldn't be posted because ${err.message} It's been set back to a draft for now.`,
      );
      logger.warn(`panel ${panel.id} demoted to draft — ${err.message}`);
      return;
    }
    throw err;
  }

  const perms = guild.members.me
    ? channel.permissionsFor(guild.members.me)
    : null;
  if (
    !perms?.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ])
  ) {
    const missing = (
      [
        [PermissionFlagsBits.ViewChannel, "View Channel"],
        [PermissionFlagsBits.SendMessages, "Send Messages"],
        [PermissionFlagsBits.EmbedLinks, "Embed Links"],
      ] as const
    )
      .filter(([flag]) => !perms?.has(flag))
      .map(([, label]) => label)
      .join(", ");
    await alertAdmins(
      guild,
      cfg,
      `${panelName} can't be posted in ${channel} — the bot is missing: ${missing}. Grant those in that channel's permissions, then re-post the panel.`,
    );
    throw new Error(
      `missing ${missing} in #${channel.name} for panel ${panel.id}`,
    );
  }

  // Try to edit the existing message; fall back to posting a new one if it was
  // deleted, moved, or is only in the client cache.
  if (panel.messageId) {
    const existing = await channel.messages
      .fetch({ message: panel.messageId, force: true })
      .catch(() => null);
    if (existing) {
      try {
        // `attachments: []` clears any previously-attached image before re-adding.
        // `content: ""` clears the status line when it's turned off.
        await existing.edit({
          content: statusLine ?? "",
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
  const msg = await channel.send({
    content: statusLine || undefined,
    embeds: [embed],
    components,
    files,
  });
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

async function handleAdminClaim(
  client: Client,
  job: JobRecord<AdminClaimTicketPayload>,
) {
  const db = getDb();
  const ticket = repos.tickets.getTicket(db, job.payload.ticketId);
  if (!ticket || ticket.status === "closed" || ticket.claimedBy) return;
  const cfg = repos.guildConfig.getGuildConfig(db, ticket.guildId);
  if (!cfg.claimingEnabled) return;
  const guild = client.guilds.cache.get(ticket.guildId);
  if (!guild) return;
  const ch =
    guild.channels.cache.get(ticket.channelId) ??
    (await guild.channels.fetch(ticket.channelId).catch(() => null));
  if (!ch || ch.type !== ChannelType.GuildText) return;

  repos.tickets.claimTicket(db, ticket.id, job.payload.staffId);
  await (ch as TextChannel)
    .send({
      content: t("ticket.claim.claimedBy", cfg.language, {
        "claimed_by.mention": `<@${job.payload.staffId}>`,
      }),
    })
    .catch(() => null);

  // Disable the Claim button on the bot's control message (best effort).
  const recent = await (ch as TextChannel).messages
    .fetch({ limit: 5 })
    .catch(() => null);
  const controls = recent?.find(
    (m) => m.author.id === client.user!.id && m.components.length > 0,
  );
  if (controls) {
    await controls
      .edit({ components: [buildTicketControls(ticket.id, { claimed: true })] })
      .catch(() => null);
  }
}

async function handleRepostApplication(
  client: Client,
  job: JobRecord<RepostApplicationPayload>,
) {
  const db = getDb();
  const app = repos.applications.getApplication(db, job.payload.applicationId);
  if (!app)
    throw new Error(`application ${job.payload.applicationId} not found`);
  const guild = client.guilds.cache.get(app.guildId);
  if (!guild) throw new Error(`guild ${app.guildId} unavailable`);
  const channel = await textChannel(client, app.guildId, app.channelId);
  if (!channel) throw new Error("application has no valid target channel");

  const { embeds, components, files } = buildApplicationMessage(app, guild);

  if (app.messageId) {
    const existing = await channel.messages
      .fetch({ message: app.messageId, force: true })
      .catch(() => null);
    if (existing) {
      try {
        await existing.edit({ embeds, components, files, attachments: [] });
        return;
      } catch (err) {
        logger.warn(`application ${app.id}: edit failed, reposting`, err);
      }
    }
  }
  const msg = await channel.send({ embeds, components, files });
  repos.applications.setApplicationMessage(db, app.id, channel.id, msg.id);
}

async function handleDecideApplication(
  client: Client,
  job: JobRecord<DecideApplicationPayload>,
) {
  const sub = repos.applications.getSubmission(
    getDb(),
    job.payload.submissionId,
  );
  if (!sub || sub.status !== "pending") return;
  await applyDecision(
    client,
    sub,
    job.payload.decision,
    job.payload.reviewerId,
    job.payload.reason ?? null,
  );
}

async function handleReservationDone(
  client: Client,
  job: JobRecord<ReservationDonePayload>,
) {
  const db = getDb();
  const r = repos.reservations.getReservation(db, job.payload.reservationId);
  if (!r) return;
  const guild = client.guilds.cache.get(r.guildId);
  if (!guild) return;
  const cfg = repos.guildConfig.getGuildConfig(db, r.guildId);
  const channel = await textChannel(client, r.guildId, cfg.logChannelId);
  if (!channel) return;

  const who = r.buyerUserId ? `<@${r.buyerUserId}>` : `**${r.buyerTag}**`;
  const bits = [`✅ Reservation fulfilled for ${who}`];
  if (r.qty > 1) bits.push(`×${r.qty}`);
  bits.push(`by <@${job.payload.staffId}>`);
  const extra = r.note ? `\n> ${r.note}` : "";
  await channel
    .send({
      content: bits.join(" ") + extra,
      allowedMentions: { parse: [] },
    })
    .catch((err) => logger.warn("reservation_done log post failed", err));
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
    case "admin_claim_ticket":
      await handleAdminClaim(client, job as JobRecord<AdminClaimTicketPayload>);
      break;
    case "repost_application":
      await handleRepostApplication(
        client,
        job as JobRecord<RepostApplicationPayload>,
      );
      break;
    case "decide_application":
      await handleDecideApplication(
        client,
        job as JobRecord<DecideApplicationPayload>,
      );
      break;
    case "reservation_done":
      await handleReservationDone(
        client,
        job as JobRecord<ReservationDonePayload>,
      );
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
