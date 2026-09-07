import { MessageFlags, type ButtonInteraction } from "discord.js";
import { t } from "@ticketbot/shared";
import { repos } from "@ticketbot/db";
import type { ButtonHandler } from "../registry.js";
import { getDb } from "../lib/db.js";
import {
  getGuildConfigCached,
  getCategoriesCached,
} from "../lib/configCache.js";
import { isStaff } from "../lib/permissions.js";
import { logger } from "../lib/logger.js";

/** Pull a value out of the ticket form by matching the field key or label. */
function pickFormValue(
  responses: { fieldKey: string; fieldLabel: string; value: string }[],
  test: RegExp,
): string {
  const hit = responses.find(
    (r) => test.test(r.fieldKey) || test.test(r.fieldLabel),
  );
  return hit?.value?.trim() ?? "";
}

/** First run of digits in a string, as a number (e.g. "50 rerolls" -> 50). */
function firstInt(s: string): number {
  const m = s.replace(/,/g, "").match(/\d+/);
  return m ? Math.min(parseInt(m[0], 10), 100000) : 0;
}

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

    // Pull Roblox name / Gakuran name / reroll count from the ticket's form.
    const responses = repos.tickets.getFormResponses(db, ticket.id);
    const robloxUser = pickFormValue(responses, /roblox/i);
    const gakuranName =
      pickFormValue(responses, /gakuran/i) ||
      pickFormValue(responses, /\bign\b|in.?game.?name/i);
    const rerollAnswer = pickFormValue(
      responses,
      /re-?roll|\brr'?s?\b|how many/i,
    );
    const qty = firstInt(rerollAnswer);

    repos.reservations.createReservation(db, {
      guildId: ticket.guildId,
      ticketId: ticket.id,
      channelId: ticket.channelId,
      buyerUserId: ticket.openerId,
      buyerTag,
      gakuranName,
      robloxUser,
      qty,
      addedBy: interaction.user.id,
    });

    await interaction.reply({
      content: t("reservation.added", guildConfig.language, {
        buyer: buyerTag,
      }),
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
