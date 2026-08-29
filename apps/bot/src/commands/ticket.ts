import {
  ChannelType,
  MessageFlags,
  SlashCommandBuilder,
  type GuildTextBasedChannel,
} from "discord.js";
import { t } from "@ticketbot/shared";
import { repos } from "@ticketbot/db";
import type { SlashCommand } from "../registry.js";
import { getDb } from "../lib/db.js";
import {
  getCategoriesCached,
  getGuildConfigCached,
} from "../lib/configCache.js";
import { isStaff } from "../lib/permissions.js";
import { buildTicketControls } from "../lib/embeds.js";
import { closeTicket } from "../lib/ticketManager.js";
import { logger } from "../lib/logger.js";

const data = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Manage the current ticket")
  .setDMPermission(false)
  .addSubcommand((s) =>
    s
      .setName("add")
      .setDescription("Add a member to this ticket")
      .addUserOption((o) =>
        o.setName("user").setDescription("Member").setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("remove")
      .setDescription("Remove a member from this ticket")
      .addUserOption((o) =>
        o.setName("user").setDescription("Member").setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("rename")
      .setDescription("Rename this ticket channel")
      .addStringOption((o) =>
        o.setName("name").setDescription("New channel name").setRequired(true),
      ),
  )
  .addSubcommand((s) => s.setName("claim").setDescription("Claim this ticket"))
  .addSubcommand((s) =>
    s
      .setName("transfer")
      .setDescription("Reassign this ticket to another staff member")
      .addUserOption((o) =>
        o
          .setName("user")
          .setDescription("New handler (must be staff)")
          .setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("close")
      .setDescription("Close this ticket")
      .addStringOption((o) =>
        o.setName("reason").setDescription("Close reason"),
      ),
  );

export const ticketCommand: SlashCommand = {
  data,
  async execute(interaction) {
    if (!interaction.inCachedGuild()) return;
    const db = getDb();
    const ticket = repos.tickets.getTicketByChannel(db, interaction.channelId);
    const guildConfig = getGuildConfigCached(interaction.guildId);
    const lang = guildConfig.language;
    if (!ticket || ticket.status === "closed") {
      await interaction.reply({
        content: t("ticket.close.notInTicket", lang),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const category =
      getCategoriesCached(interaction.guildId).find(
        (c) => c.id === ticket.categoryId,
      ) ?? null;
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const staff = isStaff(member, guildConfig, category);
    const channel = interaction.channel as GuildTextBasedChannel;
    const sub = interaction.options.getSubcommand();

    if (sub === "add" || sub === "remove") {
      if (!staff) {
        await interaction.reply({
          content: t("ticket.member.notStaff", lang),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const user = interaction.options.getUser("user", true);
      if (channel.type !== ChannelType.GuildText) return;
      if (sub === "add") {
        await channel.permissionOverwrites.edit(user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });
        repos.tickets.addMember(db, ticket.id, user.id);
        await interaction.reply({
          content: t("ticket.member.added", lang, {
            "user.mention": `<@${user.id}>`,
          }),
        });
      } else {
        await channel.permissionOverwrites.delete(user.id).catch(() => null);
        repos.tickets.removeMember(db, ticket.id, user.id);
        await interaction.reply({
          content: t("ticket.member.removed", lang, {
            "user.mention": `<@${user.id}>`,
          }),
        });
      }
      return;
    }

    if (sub === "rename") {
      if (!staff) {
        await interaction.reply({
          content: t("common.staffOnly", lang),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const name = interaction.options
        .getString("name", true)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .slice(0, 95);
      await channel.edit({ name });
      repos.tickets.renameSubject(db, ticket.id, name);
      await interaction.reply({
        content: t("ticket.rename.done", lang, { name }),
      });
      return;
    }

    if (sub === "claim" || sub === "transfer") {
      if (!guildConfig.claimingEnabled) {
        await interaction.reply({
          content: "Ticket claiming is turned off on this server.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    if (sub === "claim") {
      if (!staff) {
        await interaction.reply({
          content: t("ticket.claim.notStaff", lang),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      repos.tickets.claimTicket(db, ticket.id, interaction.user.id);
      await interaction.reply({
        content: t("ticket.claim.claimedBy", lang, {
          "claimed_by.mention": `<@${interaction.user.id}>`,
        }),
      });
      // best effort: disable the Claim button on the opening message
      const pinned = await channel.messages
        .fetch({ limit: 5 })
        .then((msgs) =>
          msgs.find(
            (m) =>
              m.author.id === interaction.client.user.id && m.components.length,
          ),
        )
        .catch(() => null);
      if (pinned) {
        await pinned
          .edit({
            components: [buildTicketControls(ticket.id, { claimed: true })],
          })
          .catch(() => null);
      }
      return;
    }

    if (sub === "transfer") {
      if (!staff) {
        await interaction.reply({
          content: t("ticket.claim.notStaff", lang),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const target = interaction.options.getUser("user", true);
      const targetMember = await interaction.guild.members
        .fetch(target.id)
        .catch(() => null);
      if (!targetMember || !isStaff(targetMember, guildConfig, category)) {
        await interaction.reply({
          content: `${target} is not a staff member for this ticket.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      repos.tickets.claimTicket(db, ticket.id, target.id);
      await interaction.reply({
        content: `Ticket transferred to ${target} by <@${interaction.user.id}>.`,
      });
      return;
    }

    // close
    if (!staff && ticket.openerId !== interaction.user.id) {
      await interaction.reply({
        content: t("common.staffOnly", lang),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const reason = interaction.options.getString("reason");
    await interaction.reply({
      content: t("ticket.close.closing", lang),
      flags: MessageFlags.Ephemeral,
    });
    try {
      await closeTicket({
        guild: interaction.guild,
        channel,
        ticket,
        closedBy: interaction.user,
        reason: reason ?? null,
        guildConfig,
      });
    } catch (err) {
      logger.error("closeTicket (slash) failed", err);
    }
  },
};
