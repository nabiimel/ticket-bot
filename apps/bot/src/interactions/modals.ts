import { MessageFlags } from "discord.js";
import { t } from "@ticketbot/shared";
import { repos } from "@ticketbot/db";
import type { ModalHandler } from "../registry.js";
import { getDb } from "../lib/db.js";
import { getCategoriesCached } from "../lib/configCache.js";
import { completeOpen } from "./openFlow.js";
import { runClose } from "./buttons.js";
import { applicationModalHandlers } from "./applications.js";
import type { FormAnswer } from "../lib/ticketManager.js";

const formModal: ModalHandler = {
  prefix: "form",
  async run(interaction, args) {
    if (!interaction.inCachedGuild()) return;
    const categoryId = Number(args[0]);
    const category = getCategoriesCached(interaction.guildId!).find(
      (c) => c.id === categoryId,
    );
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const answers: FormAnswer[] = [];
    for (const field of category?.form ?? []) {
      const value = interaction.fields
        .getTextInputValue(`field:${field.key}`)
        .trim();
      answers.push({ key: field.key, label: field.label, value });
    }
    await completeOpen(interaction, categoryId, answers);
  },
};

const closeReasonSubmit: ModalHandler = {
  prefix: "closeReasonSubmit",
  async run(interaction) {
    const reason =
      interaction.fields.getTextInputValue("reason").trim() || null;
    await runClose(interaction, reason);
  },
};

const rateComment: ModalHandler = {
  prefix: "rateComment",
  async run(interaction, args) {
    const ticketId = Number(args[0]);
    const score = Number(args[1]);
    const comment =
      interaction.fields.getTextInputValue("comment").trim() || null;
    const db = getDb();
    const ticket = repos.tickets.getTicket(db, ticketId);
    if (ticket) {
      repos.ratings.upsertRating(db, {
        ticketId,
        guildId: ticket.guildId,
        userId: interaction.user.id,
        score,
        comment,
      });
    }
    await interaction.reply({
      content: t("feedback.thanks"),
      flags: MessageFlags.Ephemeral,
    });
  },
};

export const modalHandlers: ModalHandler[] = [
  formModal,
  closeReasonSubmit,
  rateComment,
  ...applicationModalHandlers,
];
