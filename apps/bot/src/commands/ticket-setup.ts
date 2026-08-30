import {
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { SUPPORTED_LANGUAGES } from "@ticketbot/shared";
import { repos } from "@ticketbot/db";
import type { SlashCommand } from "../registry.js";
import { assertManageGuild } from "../lib/permissions.js";
import { getDb } from "../lib/db.js";
import { bustConfigCache } from "../lib/configCache.js";
import { diagnoseGuild, formatDiagnosis } from "../lib/diagnose.js";

const data = new SlashCommandBuilder()
  .setName("ticket-setup")
  .setDescription("Configure the ticket system for this server")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  .addSubcommand((s) =>
    s.setName("view").setDescription("Show the current configuration"),
  )
  .addSubcommand((s) =>
    s.setName("check").setDescription("Diagnose common setup problems"),
  )
  .addSubcommand((s) =>
    s
      .setName("general")
      .setDescription("Set core options")
      .addChannelOption((o) =>
        o
          .setName("log_channel")
          .setDescription("Channel for ticket open/close logs")
          .addChannelTypes(ChannelType.GuildText),
      )
      .addChannelOption((o) =>
        o
          .setName("transcript_channel")
          .setDescription("Channel where transcripts are posted")
          .addChannelTypes(ChannelType.GuildText),
      )
      .addRoleOption((o) =>
        o
          .setName("default_staff_role")
          .setDescription("Fallback staff role for all categories"),
      )
      .addStringOption((o) =>
        o
          .setName("language")
          .setDescription("Bot language")
          .addChoices(
            ...SUPPORTED_LANGUAGES.map((l) => ({ name: l, value: l })),
          ),
      )
      .addIntegerOption((o) =>
        o
          .setName("max_open_per_user")
          .setDescription("Max simultaneously open tickets per user")
          .setMinValue(1)
          .setMaxValue(25),
      )
      .addStringOption((o) =>
        o
          .setName("naming_scheme")
          .setDescription(
            "Channel name pattern, e.g. ticket-{number} or {username}-{number}",
          ),
      )
      .addStringOption((o) =>
        o
          .setName("close_behaviour")
          .setDescription("What to do with the channel on close")
          .addChoices(
            { name: "delete", value: "delete" },
            { name: "archive", value: "archive" },
          ),
      )
      .addChannelOption((o) =>
        o
          .setName("archive_category")
          .setDescription(
            "Category to move closed channels into (archive mode)",
          )
          .addChannelTypes(ChannelType.GuildCategory),
      )
      .addBooleanOption((o) =>
        o
          .setName("feedback")
          .setDescription("Ask the opener to rate support after close"),
      )
      .addIntegerOption((o) =>
        o
          .setName("inactivity_hours")
          .setDescription(
            "Auto-close tickets idle this many hours (0 = disabled)",
          )
          .setMinValue(0)
          .setMaxValue(720),
      ),
  );

export const ticketSetupCommand: SlashCommand = {
  data,
  async execute(interaction) {
    if (!interaction.inCachedGuild()) return;
    if (!(await assertManageGuild(interaction))) return;
    const db = getDb();
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand();

    if (sub === "check") {
      const lines = diagnoseGuild(db, interaction.guild);
      const errors = lines.filter((l) => l.level === "error").length;
      const warns = lines.filter((l) => l.level === "warn").length;
      const embed = new EmbedBuilder()
        .setTitle("Ticket setup check")
        .setColor(errors ? 0xed4245 : warns ? 0xf0a04b : 0x3ba55d)
        .setDescription(formatDiagnosis(lines))
        .setFooter({
          text: errors
            ? `${errors} problem(s) to fix`
            : warns
              ? `${warns} thing(s) worth a look`
              : "No problems found",
        });
      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "view") {
      const c = repos.guildConfig.ensureGuildConfig(db, guildId);
      const embed = new EmbedBuilder()
        .setTitle("Ticket configuration")
        .setColor(0x5865f2)
        .addFields(
          {
            name: "Log channel",
            value: c.logChannelId ? `<#${c.logChannelId}>` : "—",
            inline: true,
          },
          {
            name: "Transcript channel",
            value: c.transcriptChannelId ? `<#${c.transcriptChannelId}>` : "—",
            inline: true,
          },
          {
            name: "Default staff role",
            value: c.defaultStaffRoleId ? `<@&${c.defaultStaffRoleId}>` : "—",
            inline: true,
          },
          { name: "Language", value: c.language, inline: true },
          {
            name: "Max open / user",
            value: String(c.maxOpenPerUser),
            inline: true,
          },
          { name: "Naming", value: `\`${c.namingScheme}\``, inline: true },
          { name: "Close behaviour", value: c.closeBehaviour, inline: true },
          {
            name: "Feedback",
            value: c.feedbackEnabled ? "on" : "off",
            inline: true,
          },
          {
            name: "Inactivity auto-close",
            value: c.inactivityHours > 0 ? `${c.inactivityHours}h` : "off",
            inline: true,
          },
        )
        .setFooter({ text: "Use the web dashboard for full customization." });
      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // sub === "general"
    const patch: Record<string, unknown> = {};
    const logCh = interaction.options.getChannel("log_channel");
    const trCh = interaction.options.getChannel("transcript_channel");
    const staff = interaction.options.getRole("default_staff_role");
    const lang = interaction.options.getString("language");
    const maxOpen = interaction.options.getInteger("max_open_per_user");
    const naming = interaction.options.getString("naming_scheme");
    const closeBehaviour = interaction.options.getString("close_behaviour");
    const archiveCat = interaction.options.getChannel("archive_category");
    const feedback = interaction.options.getBoolean("feedback");
    const inactivity = interaction.options.getInteger("inactivity_hours");

    if (logCh) patch.logChannelId = logCh.id;
    if (trCh) patch.transcriptChannelId = trCh.id;
    if (staff) patch.defaultStaffRoleId = staff.id;
    if (lang) patch.language = lang;
    if (maxOpen != null) patch.maxOpenPerUser = maxOpen;
    if (naming) patch.namingScheme = naming;
    if (closeBehaviour) patch.closeBehaviour = closeBehaviour;
    if (archiveCat) patch.archiveCategoryId = archiveCat.id;
    if (feedback != null) patch.feedbackEnabled = feedback;
    if (inactivity != null) patch.inactivityHours = inactivity;

    if (Object.keys(patch).length === 0) {
      await interaction.reply({
        content: "Nothing to update — provide at least one option.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    repos.guildConfig.updateGuildConfig(db, guildId, patch);
    bustConfigCache(guildId);
    await interaction.reply({
      content: `Updated: ${Object.keys(patch).join(", ")}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
