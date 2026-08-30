import { ChannelType, PermissionFlagsBits, type Guild } from "discord.js";
import { repos } from "@ticketbot/db";
import type { DB } from "@ticketbot/db";

export type DiagnoseLevel = "ok" | "warn" | "error";
export interface DiagnoseLine {
  level: DiagnoseLevel;
  message: string;
}

const ICON: Record<DiagnoseLevel, string> = {
  ok: "✅",
  warn: "⚠️",
  error: "❌",
};

/**
 * Bot-side health check for `/ticket-setup check`. Mirrors the dashboard's
 * `guildHealth`, but runs against the live guild the bot can already see, so it
 * also covers things the dashboard can't verify (the bot's own permissions).
 */
export function diagnoseGuild(db: DB, guild: Guild): DiagnoseLine[] {
  const cfg = repos.guildConfig.getGuildConfig(db, guild.id);
  const cats = repos.categories.listCategories(db, guild.id);
  const panels = repos.panels.listPanels(db, guild.id);
  const lines: DiagnoseLine[] = [];
  const me = guild.members.me;

  // --- Bot permissions ---
  if (!me) {
    lines.push({
      level: "error",
      message: "Bot member not found in this guild.",
    });
  } else {
    const need: [bigint, string][] = [
      [PermissionFlagsBits.ManageChannels, "Manage Channels"],
      [PermissionFlagsBits.ManageRoles, "Manage Roles"],
      [PermissionFlagsBits.ViewChannel, "View Channels"],
    ];
    const missing = need
      .filter(([p]) => !me.permissions.has(p))
      .map(([, n]) => n);
    lines.push(
      missing.length
        ? { level: "error", message: `Bot is missing: ${missing.join(", ")}.` }
        : { level: "ok", message: "Bot has the permissions it needs." },
    );
  }

  // --- Channel count headroom ---
  if (guild.channels.cache.size >= 480) {
    lines.push({
      level: guild.channels.cache.size >= 500 ? "error" : "warn",
      message: `Server has ${guild.channels.cache.size}/500 channels — little room for new tickets.`,
    });
  }

  // --- Log channel ---
  if (!cfg.logChannelId) {
    lines.push({
      level: "warn",
      message: "No log channel set (`/ticket-setup general`).",
    });
  } else {
    const ch = guild.channels.cache.get(cfg.logChannelId);
    if (!ch) {
      lines.push({
        level: "error",
        message: "Log channel is set but no longer exists.",
      });
    } else if (
      ch.type === ChannelType.GuildText &&
      me &&
      !ch.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)
    ) {
      lines.push({
        level: "error",
        message: `Bot can't send in the log channel ${ch}.`,
      });
    } else {
      lines.push({ level: "ok", message: "Log channel is reachable." });
    }
  }

  // --- Transcript channel (optional, falls back to log) ---
  if (!cfg.transcriptChannelId) {
    lines.push({
      level: "warn",
      message: "No transcript channel set — transcripts go to the log channel.",
    });
  } else if (!guild.channels.cache.has(cfg.transcriptChannelId)) {
    lines.push({
      level: "error",
      message: "Transcript channel is set but no longer exists.",
    });
  }

  // --- Categories ---
  if (cats.length === 0) {
    lines.push({
      level: "error",
      message: "No ticket categories — members have nothing to open.",
    });
  } else {
    for (const c of cats) {
      if (c.staffRoleIds.length === 0 && !cfg.defaultStaffRoleId) {
        lines.push({
          level: "error",
          message: `“${c.label}” has no staff role and there's no default — nobody could see its tickets.`,
        });
      }
      const dead = c.staffRoleIds.filter(
        (id) => !guild.roles.cache.has(id),
      ).length;
      if (dead > 0) {
        lines.push({
          level: "warn",
          message: `“${c.label}” references ${dead} deleted staff role(s).`,
        });
      }
      if (c.discordParentId && !guild.channels.cache.has(c.discordParentId)) {
        lines.push({
          level: "warn",
          message: `“${c.label}” opens under a Discord category that no longer exists.`,
        });
      }
    }
  }

  // --- Panels ---
  const published = panels.filter((p) => p.status === "published");
  if (published.length === 0) {
    lines.push({
      level: "warn",
      message: "No published panel — members can't open a ticket yet.",
    });
  }
  for (const p of published) {
    const label = p.embed.title ? `“${p.embed.title}”` : `#${p.id}`;
    if (!p.channelId) {
      lines.push({
        level: "error",
        message: `Panel ${label} is published with no target channel.`,
      });
      continue;
    }
    const ch = guild.channels.cache.get(p.channelId);
    if (!ch) {
      lines.push({
        level: "error",
        message: `Panel ${label} points at a channel that no longer exists.`,
      });
    } else if (
      ch.type === ChannelType.GuildText &&
      me &&
      !ch
        .permissionsFor(me)
        ?.has([
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
        ])
    ) {
      lines.push({
        level: "error",
        message: `Bot can't post the panel in ${ch}.`,
      });
    }
    if (p.categoryIds.length === 0) {
      lines.push({
        level: "warn",
        message: `Panel ${label} has no ticket types on it.`,
      });
    }
  }

  if (lines.every((l) => l.level === "ok")) {
    lines.push({ level: "ok", message: "Everything checks out." });
  }
  return lines;
}

export function formatDiagnosis(lines: DiagnoseLine[]): string {
  return lines.map((l) => `${ICON[l.level]} ${l.message}`).join("\n");
}
