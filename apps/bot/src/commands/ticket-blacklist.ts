import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { t } from "@ticketbot/shared";
import { repos } from "@ticketbot/db";
import type { SlashCommand } from "../registry.js";
import { assertManageGuild } from "../lib/permissions.js";
import { getDb } from "../lib/db.js";

const data = new SlashCommandBuilder()
  .setName("ticket-blacklist")
  .setDescription("Block or unblock users from opening tickets")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  .addSubcommand((s) =>
    s
      .setName("add")
      .setDescription("Block a user")
      .addUserOption((o) =>
        o.setName("user").setDescription("User").setRequired(true),
      )
      .addStringOption((o) => o.setName("reason").setDescription("Reason")),
  )
  .addSubcommand((s) =>
    s
      .setName("remove")
      .setDescription("Unblock a user")
      .addUserOption((o) =>
        o.setName("user").setDescription("User").setRequired(true),
      ),
  )
  .addSubcommand((s) => s.setName("list").setDescription("List blocked users"));

export const ticketBlacklistCommand: SlashCommand = {
  data,
  async execute(interaction) {
    if (!interaction.inCachedGuild()) return;
    if (!(await assertManageGuild(interaction))) return;
    const db = getDb();
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand();

    if (sub === "list") {
      const rows = repos.blacklist.listBlacklist(db, guildId);
      const embed = new EmbedBuilder()
        .setTitle("Ticket blacklist")
        .setColor(0xed4245)
        .setDescription(
          rows.length
            ? rows
                .map(
                  (r) =>
                    `<@${r.userId}>${r.reason ? ` — ${r.reason}` : ""} (by <@${r.addedBy}>)`,
                )
                .join("\n")
            : "No blocked users.",
        );
      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const user = interaction.options.getUser("user", true);
    if (sub === "add") {
      repos.blacklist.addToBlacklist(
        db,
        guildId,
        user.id,
        interaction.user.id,
        interaction.options.getString("reason"),
      );
      await interaction.reply({
        content: t("blacklist.added", undefined, { "user.tag": user.tag }),
        flags: MessageFlags.Ephemeral,
      });
    } else {
      const removed = repos.blacklist.removeFromBlacklist(db, guildId, user.id);
      await interaction.reply({
        content: removed
          ? t("blacklist.removed", undefined, { "user.tag": user.tag })
          : t("blacklist.notFound", undefined, { "user.tag": user.tag }),
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
