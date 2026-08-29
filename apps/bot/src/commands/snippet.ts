import {
  MessageFlags,
  SlashCommandBuilder,
  type GuildTextBasedChannel,
} from "discord.js";
import { renderTemplate, t } from "@ticketbot/shared";
import { repos } from "@ticketbot/db";
import type { SlashCommand } from "../registry.js";
import { getDb } from "../lib/db.js";
import {
  getCategoriesCached,
  getGuildConfigCached,
} from "../lib/configCache.js";
import { isStaff } from "../lib/permissions.js";
import { buildContext } from "../lib/context.js";
import { injectFormTokens } from "../lib/ticketManager.js";
import { resolveUploadFiles } from "../lib/embedAssets.js";
import { logger } from "../lib/logger.js";

const data = new SlashCommandBuilder()
  .setName("snippet")
  .setDescription("Post a saved reply into this ticket")
  .setDMPermission(false)
  .addStringOption((o) =>
    o
      .setName("name")
      .setDescription("Which saved reply to send")
      .setRequired(true)
      .setAutocomplete(true),
  );

export const snippetCommand: SlashCommand = {
  data,

  async autocomplete(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.respond([]);
      return;
    }
    const typed = interaction.options.getFocused().toString().toLowerCase();
    const names = repos.snippets
      .listSnippets(getDb(), interaction.guildId)
      .map((s) => s.name)
      .filter((n) => n.includes(typed))
      .slice(0, 25);
    await interaction.respond(names.map((n) => ({ name: n, value: n })));
  },

  async execute(interaction) {
    if (!interaction.inCachedGuild()) return;
    const db = getDb();
    const guildConfig = getGuildConfigCached(interaction.guildId);
    const lang = guildConfig.language;

    const ticket = repos.tickets.getTicketByChannel(db, interaction.channelId);
    if (!ticket || ticket.status === "closed") {
      await interaction.reply({
        content: t("snippet.notInTicket", lang),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const category =
      getCategoriesCached(interaction.guildId).find(
        (c) => c.id === ticket.categoryId,
      ) ?? null;
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!isStaff(member, guildConfig, category)) {
      await interaction.reply({
        content: t("common.staffOnly", lang),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const name = interaction.options.getString("name", true).toLowerCase();
    const snippet = repos.snippets.getSnippetByName(
      db,
      interaction.guildId,
      name,
    );
    if (!snippet) {
      await interaction.reply({
        content: t("snippet.notFound", lang, { name }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const opener = await interaction.guild.members
      .fetch(ticket.openerId)
      .catch(() => null);
    const ctx = buildContext({
      guild: interaction.guild,
      opener: opener ?? undefined,
      category,
      ticket,
    });
    injectFormTokens(
      ctx,
      repos.tickets.getFormResponses(db, ticket.id).map((r) => ({
        key: r.fieldKey,
        label: r.fieldLabel,
        value: r.value,
      })),
    );

    const content = (renderTemplate(snippet.content, ctx) ?? "").trim();
    const files = resolveUploadFiles(snippet.attachments);
    if (!content && files.length === 0) {
      await interaction.reply({
        content: t("snippet.empty", lang),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channel = interaction.channel as GuildTextBasedChannel;
    try {
      await channel.send({
        content: content || undefined,
        files,
        allowedMentions: { parse: ["users"] },
      });
    } catch (err) {
      logger.error("snippet send failed", err);
      await interaction.reply({
        content: t("common.error", lang),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: t("snippet.sent", lang, { name: snippet.name }),
      flags: MessageFlags.Ephemeral,
    });
  },
};
