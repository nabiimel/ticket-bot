import { MessageFlags, type ButtonInteraction } from "discord.js";
import { robuxCost, t, type RobuxRate } from "@ticketbot/shared";
import { repos } from "@ticketbot/db";
import type { ButtonHandler } from "../registry.js";
import { getDb } from "../lib/db.js";
import {
  getGuildConfigCached,
  getCategoriesCached,
} from "../lib/configCache.js";
import { isStaff } from "../lib/permissions.js";
import { buildControlsPayload } from "../lib/pipeline.js";
import { extractReservationFields } from "../lib/reservationExtract.js";
import { logger } from "../lib/logger.js";

const reserveButton: ButtonHandler = {
  prefix: "reserve",
  async run(interaction: ButtonInteraction) {
    if (!interaction.inCachedGuild()) return;
    const db = getDb();
    const ticket = repos.tickets.getTicketByChannel(db, interaction.channelId);
    if (!ticket) {
      await interaction.reply({
        content: t("ticket.close.notInTicket"),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const guildConfig = getGuildConfigCached(interaction.guildId);
    const category =
      getCategoriesCached(interaction.guildId).find(
        (c) => c.id === ticket.categoryId,
      ) ?? null;
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!isStaff(member, guildConfig, category)) {
      await interaction.reply({
        content: t("reservation.staffOnly", guildConfig.language),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const existing = repos.reservations.getOpenForTicket(db, ticket.id);
    if (existing) {
      await interaction.reply({
        content: t("reservation.already", guildConfig.language, {
          when: `<t:${existing.addedAt}:R>`,
          by: existing.addedBy ? `<@${existing.addedBy}>` : "staff",
        }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const buyer = await interaction.guild.members
      .fetch(ticket.openerId)
      .catch(() => null);
    const buyerTag =
      buyer?.displayName ?? buyer?.user.username ?? ticket.openerId;

    // Pull Roblox name / Gakuran name / reroll count from the ticket's form —
    // either one set of fields, or (a multi-person order) one set per person.
    const responses = repos.tickets.getFormResponses(db, ticket.id);
    const { gakuranName, robloxUser, qty, breakdown } =
      extractReservationFields(responses);

    repos.reservations.createReservation(db, {
      guildId: ticket.guildId,
      ticketId: ticket.id,
      channelId: ticket.channelId,
      buyerUserId: ticket.openerId,
      buyerTag,
      gakuranName,
      robloxUser,
      qty,
      breakdown,
      addedBy: interaction.user.id,
    });
    repos.audit.logAudit(db, {
      guildId: ticket.guildId,
      actorId: interaction.user.id,
      action: "reservation.add",
      summary: `Reserved for ${gakuranName || buyerTag}${qty ? ` (${qty} RR's)` : ""}`,
    });

    // Redraw the stock embed so Reserved / Remaining reflect this reservation.
    const budget = guildConfig.reservationsRobuxBudget;
    repos.jobs.enqueueJob(db, ticket.guildId, "post_stock_update", {
      robux: budget,
      previous: budget,
    });

    const rate: RobuxRate = {
      rerollUnit: guildConfig.reservationsRerollUnit,
      robuxPerUnit: guildConfig.reservationsRobuxPerUnit,
      discountPct: guildConfig.reservationsDiscountPct,
    };
    const committed = robuxCost(
      repos.reservations.sumRerolls(db, ticket.guildId),
      rate,
    );
    const over = committed - budget;

    let content = t("reservation.added", guildConfig.language, {
      buyer: buyerTag,
    });
    if (over > 0) {
      content += `\n${t("reservation.overBudget", guildConfig.language, { over: over.toLocaleString() })}`;
    }

    await interaction.update(
      buildControlsPayload(ticket, guildConfig, { reserved: true }),
    );
    await interaction.followUp({
      content,
      flags: MessageFlags.Ephemeral,
    });

    // Leave a visible trace in the ticket, mentions disabled.
    if (interaction.channel?.isSendable()) {
      await interaction.channel
        .send({
          content: t("reservation.channelNote", guildConfig.language, {
            buyer: `<@${ticket.openerId}>`,
            by: `<@${interaction.user.id}>`,
          }),
          allowedMentions: { parse: [] },
        })
        .catch((err) => logger.warn("reservation channel note failed", err));
    }
  },
};

export const reservationButtonHandlers: ButtonHandler[] = [reserveButton];
