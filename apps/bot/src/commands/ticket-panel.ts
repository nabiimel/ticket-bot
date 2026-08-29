import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type TextChannel,
} from "discord.js";
import { DEFAULT_PANEL_EMBED } from "@ticketbot/shared";
import { repos } from "@ticketbot/db";
import type { SlashCommand } from "../registry.js";
import { assertManageGuild } from "../lib/permissions.js";
import { getDb } from "../lib/db.js";
import { buildContext } from "../lib/context.js";
import { buildPanelComponents } from "../lib/embeds.js";
import { buildEmbedWithAssets } from "../lib/embedAssets.js";

const data = new SlashCommandBuilder()
  .setName("ticket-panel")
  .setDescription("Post or refresh a ticket panel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  .addSubcommand((s) =>
    s
      .setName("create")
      .setDescription("Create a panel with all categories and post it")
      .addChannelOption((o) =>
        o
          .setName("channel")
          .setDescription("Where to post the panel")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName("style")
          .setDescription("buttons or dropdown")
          .addChoices(
            { name: "buttons", value: "buttons" },
            { name: "dropdown", value: "dropdown" },
          ),
      )
      .addStringOption((o) => o.setName("title").setDescription("Embed title"))
      .addStringOption((o) =>
        o.setName("description").setDescription("Embed description"),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("resend")
      .setDescription("Re-post an existing panel")
      .addIntegerOption((o) =>
        o.setName("id").setDescription("Panel id").setRequired(true),
      )
      .addChannelOption((o) =>
        o
          .setName("channel")
          .setDescription("Channel to post into (defaults to the stored one)")
          .addChannelTypes(ChannelType.GuildText),
      ),
  );

export const ticketPanelCommand: SlashCommand = {
  data,
  async execute(interaction) {
    if (!interaction.inCachedGuild()) return;
    if (!(await assertManageGuild(interaction))) return;
    const db = getDb();
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand();

    if (sub === "create") {
      const cats = repos.categories.listCategories(db, guildId);
      if (cats.length === 0) {
        await interaction.reply({
          content:
            "Create at least one category first with `/ticket-category add`.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const channel = interaction.options.getChannel(
        "channel",
        true,
      ) as TextChannel;
      const style =
        (interaction.options.getString("style") as
          "buttons" | "dropdown" | null) ??
        (cats.length > 5 ? "dropdown" : "buttons");
      const embed = {
        ...DEFAULT_PANEL_EMBED,
        title:
          interaction.options.getString("title") ?? DEFAULT_PANEL_EMBED.title,
        description:
          interaction.options.getString("description") ??
          DEFAULT_PANEL_EMBED.description,
      };

      const panel = repos.panels.createPanel(db, guildId, {
        channelId: channel.id,
        style,
        embed,
        categoryIds: cats.map((c) => c.id),
        buttons: Object.fromEntries(
          cats.map((c) => [String(c.id), { label: c.label, style: "Primary" }]),
        ),
        status: "published",
        createdBy: interaction.user.id,
      });

      const created = buildEmbedWithAssets(
        panel.embed,
        buildContext({ guild: interaction.guild }),
      );
      const msg = await channel.send({
        embeds: [created.embed],
        files: created.files,
        components: buildPanelComponents(panel, cats, interaction.guild.name),
      });
      repos.panels.setPanelMessage(db, panel.id, channel.id, msg.id);
      await interaction.reply({
        content: `Panel #${panel.id} posted in ${channel}. Fine-tune it in the dashboard.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // resend
    const id = interaction.options.getInteger("id", true);
    const panel = repos.panels.getPanel(db, id);
    if (!panel || panel.guildId !== guildId) {
      await interaction.reply({
        content: `No panel #${id} in this server.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const targetId =
      interaction.options.getChannel("channel")?.id ?? panel.channelId;
    const target = targetId
      ? ((await interaction.guild.channels
          .fetch(targetId)
          .catch(() => null)) as TextChannel | null)
      : null;
    if (!target) {
      await interaction.reply({
        content: "No target channel available for this panel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const cats = repos.categories.listCategories(db, guildId);
    const resent = buildEmbedWithAssets(
      panel.embed,
      buildContext({ guild: interaction.guild }),
    );
    const msg = await target.send({
      embeds: [resent.embed],
      files: resent.files,
      components: buildPanelComponents(panel, cats, interaction.guild.name),
    });
    repos.panels.setPanelMessage(db, panel.id, target.id, msg.id);
    await interaction.reply({
      content: `Panel #${panel.id} re-posted in ${target}.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
