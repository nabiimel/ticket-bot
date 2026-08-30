import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type Guild,
} from "discord.js";
import type { CategoryConfig, GuildConfig } from "@ticketbot/shared";
import { hit } from "./cooldown.js";
import { logger } from "./logger.js";

/** Discord hard limits. */
const GUILD_CHANNEL_CAP = 500;
const CATEGORY_CHILD_CAP = 50;

export interface PreflightResult {
  ok: boolean;
  /** Locale key shown to the ticket opener when `ok` is false. */
  userKey?: string;
  /** Plain-English detail for the staff alert + logs. */
  adminMessage?: string;
}

/**
 * Checks everything that would make `guild.channels.create()` throw *before* we
 * try, so the opener gets a clear message and staff get told what to fix —
 * instead of a generic failure and a silent log line.
 */
export function preflightTicketCreate(
  guild: Guild,
  category: CategoryConfig,
): PreflightResult {
  const me = guild.members.me;
  if (!me) {
    return {
      ok: false,
      userKey: "ticket.open.failed",
      adminMessage: "The bot's own guild member wasn't in cache — transient.",
    };
  }

  const missing: string[] = [];
  if (!me.permissions.has(PermissionFlagsBits.ManageChannels))
    missing.push("Manage Channels");
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles))
    missing.push("Manage Roles");
  if (missing.length) {
    return {
      ok: false,
      userKey: "ticket.open.systemProblem",
      adminMessage: `The bot is missing permission(s): **${missing.join(
        ", ",
      )}**. Grant them to the bot's role in Server Settings → Roles.`,
    };
  }

  if (guild.channels.cache.size >= GUILD_CHANNEL_CAP) {
    return {
      ok: false,
      userKey: "ticket.open.serverFull",
      adminMessage: `This server is at Discord's ${GUILD_CHANNEL_CAP}-channel limit. Delete unused channels or archived tickets before more can be opened.`,
    };
  }

  const parentId = category.discordParentId;
  if (parentId) {
    const parent = guild.channels.cache.get(parentId);
    if (!parent || parent.type !== ChannelType.GuildCategory) {
      return {
        ok: false,
        userKey: "ticket.open.systemProblem",
        adminMessage: `Ticket type “${category.label}” is set to open under a Discord category that no longer exists. Fix or clear its “Parent category” in the dashboard.`,
      };
    }
    const children = guild.channels.cache.filter(
      (c) => c.parentId === parentId,
    ).size;
    if (children >= CATEGORY_CHILD_CAP) {
      return {
        ok: false,
        userKey: "ticket.open.systemProblem",
        adminMessage: `The Discord category for “${category.label}” holds ${children}/${CATEGORY_CHILD_CAP} channels. Move it, point the ticket type at a different parent, or archive old tickets.`,
      };
    }
  }

  return { ok: true };
}

/**
 * Tell staff something's wrong. Posts to the log channel, falls back to DMing
 * the guild owner. Throttled to one alert per guild per 5 minutes so a broken
 * config can't spam the channel.
 */
export async function alertAdmins(
  guild: Guild,
  guildConfig: GuildConfig,
  message: string,
): Promise<void> {
  if (!hit(`admin-alert:${guild.id}`, 5 * 60_000)) return;

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("⚠️ Ticket system needs attention")
    .setDescription(message)
    .setFooter({ text: "This alert is rate-limited to once every 5 minutes." })
    .setTimestamp();

  const logCh = guildConfig.logChannelId
    ? guild.channels.cache.get(guildConfig.logChannelId)
    : null;
  if (logCh && logCh.type === ChannelType.GuildText) {
    const sent = await logCh.send({ embeds: [embed] }).catch(() => null);
    if (sent) return;
  }

  const owner = await guild.fetchOwner().catch(() => null);
  if (owner) {
    await owner.send({ embeds: [embed] }).catch(() => null);
    return;
  }
  logger.warn(
    `admin alert for guild ${guild.id} had nowhere to go: ${message}`,
  );
}
