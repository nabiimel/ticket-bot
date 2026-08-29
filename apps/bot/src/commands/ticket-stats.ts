import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { repos } from "@ticketbot/db";
import type { SlashCommand } from "../registry.js";
import { assertManageGuild } from "../lib/permissions.js";
import { getDb } from "../lib/db.js";

function fmtDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
  return `${(s / 86400).toFixed(1)}d`;
}

const data = new SlashCommandBuilder()
  .setName("ticket-stats")
  .setDescription("Show ticket metrics")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  .addIntegerOption((o) =>
    o
      .setName("days")
      .setDescription("Window in days (default 30)")
      .setMinValue(1)
      .setMaxValue(365),
  );

export const ticketStatsCommand: SlashCommand = {
  data,
  async execute(interaction) {
    if (!interaction.inCachedGuild()) return;
    if (!(await assertManageGuild(interaction))) return;
    const days = interaction.options.getInteger("days") ?? 30;
    const s = repos.stats.getGuildStats(getDb(), interaction.guildId, days);

    const embed = new EmbedBuilder()
      .setTitle(`Ticket stats — last ${days} day(s)`)
      .setColor(0x5865f2)
      .addFields(
        { name: "Open", value: String(s.openCount), inline: true },
        { name: "Closed", value: String(s.closedCount), inline: true },
        { name: "Total", value: String(s.totalCount), inline: true },
        {
          name: "Avg time to claim",
          value: fmtDuration(s.avgSecondsToClaim),
          inline: true,
        },
        {
          name: "Avg time to close",
          value: fmtDuration(s.avgSecondsToClose),
          inline: true,
        },
        {
          name: "Avg rating",
          value:
            s.avgRating != null
              ? `${s.avgRating.toFixed(2)} (${s.ratingCount})`
              : "—",
          inline: true,
        },
      );

    if (s.byCategory.length) {
      embed.addFields({
        name: "By category",
        value: s.byCategory
          .map((c) => `${c.label}: ${c.count}`)
          .join("\n")
          .slice(0, 1024),
      });
    }
    if (s.perStaff.length) {
      embed.addFields({
        name: "Staff activity (claimed / closed)",
        value: s.perStaff
          .slice(0, 15)
          .map((p) => `<@${p.staffId}>: ${p.claimed} / ${p.closed}`)
          .join("\n")
          .slice(0, 1024),
      });
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
