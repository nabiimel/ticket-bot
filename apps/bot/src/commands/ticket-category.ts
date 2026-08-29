import {
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { repos } from "@ticketbot/db";
import type { SlashCommand } from "../registry.js";
import { assertManageGuild } from "../lib/permissions.js";
import { getDb } from "../lib/db.js";
import { bustConfigCache } from "../lib/configCache.js";

const KEY_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;

const data = new SlashCommandBuilder()
  .setName("ticket-category")
  .setDescription("Manage ticket categories")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  .addSubcommand((s) =>
    s
      .setName("add")
      .setDescription("Create a category")
      .addStringOption((o) =>
        o
          .setName("key")
          .setDescription("Unique key, e.g. support")
          .setRequired(true),
      )
      .addStringOption((o) =>
        o.setName("label").setDescription("Display name").setRequired(true),
      )
      .addRoleOption((o) =>
        o.setName("staff_role").setDescription("Staff role for this category"),
      )
      .addChannelOption((o) =>
        o
          .setName("parent")
          .setDescription("Discord category to create ticket channels under")
          .addChannelTypes(ChannelType.GuildCategory),
      )
      .addStringOption((o) =>
        o.setName("emoji").setDescription("Button/menu emoji"),
      )
      .addStringOption((o) =>
        o
          .setName("description")
          .setDescription("Short description shown in the menu"),
      )
      .addRoleOption((o) =>
        o
          .setName("ping_role")
          .setDescription("Role to ping when a ticket opens"),
      )
      .addIntegerOption((o) =>
        o
          .setName("per_user_limit")
          .setDescription("Max open tickets per user in this category")
          .setMinValue(1)
          .setMaxValue(25),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("edit")
      .setDescription("Edit a category")
      .addStringOption((o) =>
        o.setName("key").setDescription("Category key").setRequired(true),
      )
      .addStringOption((o) => o.setName("label").setDescription("Display name"))
      .addRoleOption((o) =>
        o.setName("staff_role").setDescription("Staff role"),
      )
      .addChannelOption((o) =>
        o
          .setName("parent")
          .setDescription("Parent Discord category")
          .addChannelTypes(ChannelType.GuildCategory),
      )
      .addStringOption((o) => o.setName("emoji").setDescription("Emoji"))
      .addStringOption((o) =>
        o.setName("description").setDescription("Description"),
      )
      .addRoleOption((o) => o.setName("ping_role").setDescription("Ping role"))
      .addIntegerOption((o) =>
        o
          .setName("per_user_limit")
          .setDescription("Per-user limit (0 to clear)")
          .setMinValue(0)
          .setMaxValue(25),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("remove")
      .setDescription("Delete a category")
      .addStringOption((o) =>
        o.setName("key").setDescription("Category key").setRequired(true),
      ),
  )
  .addSubcommand((s) => s.setName("list").setDescription("List categories"));

export const ticketCategoryCommand: SlashCommand = {
  data,
  async execute(interaction) {
    if (!interaction.inCachedGuild()) return;
    if (!(await assertManageGuild(interaction))) return;
    const db = getDb();
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand();

    if (sub === "list") {
      const cats = repos.categories.listCategories(db, guildId);
      if (cats.length === 0) {
        await interaction.reply({
          content: "No categories yet. Use `/ticket-category add`.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle("Ticket categories")
        .setColor(0x5865f2)
        .setDescription(
          cats
            .map(
              (c) =>
                `**${c.label}** \`${c.key}\`${c.emoji ? ` ${c.emoji}` : ""}\n` +
                `• staff: ${c.staffRoleIds.map((r) => `<@&${r}>`).join(", ") || "—"}` +
                ` • parent: ${c.discordParentId ? `<#${c.discordParentId}>` : "—"}` +
                ` • form fields: ${c.form.length}`,
            )
            .join("\n\n"),
        );
      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "add") {
      const key = interaction.options.getString("key", true).toLowerCase();
      if (!KEY_RE.test(key)) {
        await interaction.reply({
          content:
            "Key must be lowercase letters, numbers, `-` or `_` (max 32).",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (repos.categories.getCategoryByKey(db, guildId, key)) {
        await interaction.reply({
          content: `A category with key \`${key}\` already exists.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const staff = interaction.options.getRole("staff_role");
      const ping = interaction.options.getRole("ping_role");
      const parent = interaction.options.getChannel("parent");
      const cat = repos.categories.createCategory(db, guildId, {
        key,
        label: interaction.options.getString("label", true),
        emoji: interaction.options.getString("emoji"),
        description: interaction.options.getString("description"),
        staffRoleIds: staff ? [staff.id] : [],
        pingRoleIds: ping ? [ping.id] : [],
        discordParentId: parent?.id ?? null,
        perUserLimit: interaction.options.getInteger("per_user_limit"),
      });
      bustConfigCache(guildId);
      await interaction.reply({
        content: `Created category **${cat.label}** (\`${cat.key}\`). Add form fields and styling in the dashboard.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "edit") {
      const key = interaction.options.getString("key", true).toLowerCase();
      const cat = repos.categories.getCategoryByKey(db, guildId, key);
      if (!cat) {
        await interaction.reply({
          content: `No category with key \`${key}\`.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const patch: Record<string, unknown> = {};
      const label = interaction.options.getString("label");
      const staff = interaction.options.getRole("staff_role");
      const ping = interaction.options.getRole("ping_role");
      const parent = interaction.options.getChannel("parent");
      const emoji = interaction.options.getString("emoji");
      const description = interaction.options.getString("description");
      const limit = interaction.options.getInteger("per_user_limit");
      if (label) patch.label = label;
      if (staff) patch.staffRoleIds = [staff.id];
      if (ping) patch.pingRoleIds = [ping.id];
      if (parent) patch.discordParentId = parent.id;
      if (emoji) patch.emoji = emoji;
      if (description) patch.description = description;
      if (limit != null) patch.perUserLimit = limit === 0 ? null : limit;
      if (Object.keys(patch).length === 0) {
        await interaction.reply({
          content: "Provide at least one field to change.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      repos.categories.updateCategory(db, cat.id, patch);
      repos.jobs.enqueueJob(db, guildId, "sync_ticket_perms", {
        categoryId: cat.id,
      });
      bustConfigCache(guildId);
      await interaction.reply({
        content: `Updated **${cat.label}**: ${Object.keys(patch).join(", ")}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "remove") {
      const key = interaction.options.getString("key", true).toLowerCase();
      const cat = repos.categories.getCategoryByKey(db, guildId, key);
      if (!cat) {
        await interaction.reply({
          content: `No category with key \`${key}\`.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      repos.categories.deleteCategory(db, cat.id);
      bustConfigCache(guildId);
      await interaction.reply({
        content: `Deleted category \`${key}\`.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
