import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
} from "discord.js";
import { t } from "@ticketbot/shared";
import { repos } from "@ticketbot/db";
import type { ButtonHandler } from "../registry.js";
import { getDb } from "../lib/db.js";
import {
  getGuildConfigCached,
  getCategoriesCached,
} from "../lib/configCache.js";
import { buildCloseConfirm, buildTicketControls } from "../lib/embeds.js";
import { isStaff } from "../lib/permissions.js";
import { closeTicket } from "../lib/ticketManager.js";
import { startOpen } from "./openFlow.js";
import { applicationButtonHandlers } from "./applications.js";
import { logger } from "../lib/logger.js";

const openButton: ButtonHandler = {
  prefix: "open",
  async run(interaction, args) {
    const categoryId = Number(args[0]);
    if (Number.isNaN(categoryId)) return;
    // `open:<categoryId>:<panelId>` — panelId is absent on pre-analytics panels.
    const panelId = args[1] ? Number(args[1]) : null;
    await startOpen(
      interaction,
      categoryId,
      Number.isNaN(panelId as number) ? null : panelId,
    );
  },
};

function ticketFromInteraction(interaction: ButtonInteraction) {
  return repos.tickets.getTicketByChannel(getDb(), interaction.channelId!);
}

const claimButton: ButtonHandler = {
  prefix: "claim",
  async run(interaction) {
    if (!interaction.inCachedGuild()) return;
    const db = getDb();
    const ticket = ticketFromInteraction(interaction);
    if (!ticket) {
      await interaction.reply({
        content: t("ticket.close.notInTicket"),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const guildConfig = getGuildConfigCached(interaction.guildId!);
    if (!guildConfig.claimingEnabled) {
      await interaction.reply({
        content: "Ticket claiming is turned off on this server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const category =
      getCategoriesCached(interaction.guildId!).find(
        (c) => c.id === ticket.categoryId,
      ) ?? null;
    const member = await interaction.guild!.members.fetch(interaction.user.id);
    if (!isStaff(member, guildConfig, category)) {
      await interaction.reply({
        content: t("ticket.claim.notStaff", guildConfig.language),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id) {
      const claimer = await interaction
        .guild!.members.fetch(ticket.claimedBy)
        .catch(() => null);
      await interaction.reply({
        content: t("ticket.claim.alreadyClaimed", guildConfig.language, {
          claimed_by: claimer?.displayName ?? "someone",
        }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    repos.tickets.claimTicket(db, ticket.id, interaction.user.id);
    await interaction.update({
      components: [buildTicketControls(ticket.id, { claimed: true })],
    });
    await interaction.followUp({
      content: t("ticket.claim.claimedBy", guildConfig.language, {
        "claimed_by.mention": `<@${interaction.user.id}>`,
      }),
    });
  },
};

const closeButton: ButtonHandler = {
  prefix: "close",
  async run(interaction, args) {
    const ticketId = Number(args[0]);
    const guildConfig = interaction.inCachedGuild()
      ? getGuildConfigCached(interaction.guildId!)
      : null;
    await interaction.reply({
      content: `**${t("ticket.close.confirmTitle", guildConfig?.language)}**\n${t(
        "ticket.close.confirmBody",
        guildConfig?.language,
      )}`,
      components: [buildCloseConfirm(ticketId)],
      flags: MessageFlags.Ephemeral,
    });
  },
};

const closeConfirmButton: ButtonHandler = {
  prefix: "closeConfirm",
  async run(interaction, args) {
    if (!interaction.inCachedGuild()) return;
    const [, decision] = args;
    if (decision !== "yes") {
      await interaction.update({
        content: "Cancelled.",
        components: [],
      });
      return;
    }
    await runClose(interaction, null);
  },
};

const closeReasonButton: ButtonHandler = {
  prefix: "closeReason",
  async run(interaction, args) {
    const ticketId = Number(args[0]);
    const lang = interaction.inCachedGuild()
      ? getGuildConfigCached(interaction.guildId!).language
      : "en";
    const modal = new ModalBuilder()
      .setCustomId(`closeReasonSubmit:${ticketId}`)
      .setTitle(t("ticket.close.confirmTitle", lang).slice(0, 45))
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("reason")
            .setLabel(t("ticket.close.reasonLabel", lang).slice(0, 45))
            .setPlaceholder(
              t("ticket.close.reasonPlaceholder", lang).slice(0, 100),
            )
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(1000),
        ),
      );
    await interaction.showModal(modal);
  },
};

/** Shared close routine used by the confirm button and the reason modal. */
export async function runClose(
  interaction: ButtonInteraction | import("discord.js").ModalSubmitInteraction,
  reason: string | null,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  const db = getDb();
  const ticket = repos.tickets.getTicketByChannel(db, interaction.channelId!);
  const guildConfig = getGuildConfigCached(interaction.guildId!);
  if (!ticket || ticket.status === "closed") {
    const payload = {
      content: t("ticket.close.notInTicket", guildConfig.language),
      components: [],
    };
    if (interaction.isButton()) await interaction.update(payload);
    else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    return;
  }

  const ack = {
    content: t("ticket.close.closing", guildConfig.language),
    components: [],
  };
  if (interaction.isButton()) await interaction.update(ack);
  else await interaction.reply({ ...ack, flags: MessageFlags.Ephemeral });

  try {
    await closeTicket({
      guild: interaction.guild!,
      channel:
        interaction.channel as import("discord.js").GuildTextBasedChannel,
      ticket,
      closedBy: interaction.user,
      reason,
      guildConfig,
    });
  } catch (err) {
    logger.error("closeTicket failed", err);
  }
}

const rateButton: ButtonHandler = {
  prefix: "rate",
  async run(interaction, args) {
    const ticketId = Number(args[0]);
    const score = Number(args[1]);
    if (Number.isNaN(ticketId) || score < 1 || score > 5) return;
    const db = getDb();
    const ticket = repos.tickets.getTicket(db, ticketId);
    if (!ticket) {
      await interaction.reply({
        content: t("common.error"),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    repos.ratings.upsertRating(db, {
      ticketId,
      guildId: ticket.guildId,
      userId: interaction.user.id,
      score,
    });
    const modal = new ModalBuilder()
      .setCustomId(`rateComment:${ticketId}:${score}`)
      .setTitle("Feedback")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("comment")
            .setLabel("Any additional comments?")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(1000),
        ),
      );
    await interaction.showModal(modal);
  },
};

export const buttonHandlers: ButtonHandler[] = [
  openButton,
  claimButton,
  closeConfirmButton, // must be registered before closeButton (prefix match order)
  closeReasonButton,
  closeButton,
  rateButton,
  ...applicationButtonHandlers,
];
