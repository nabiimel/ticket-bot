import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import { renderTemplate, t, type CategoryConfig } from "@ticketbot/shared";
import { repos } from "@ticketbot/db";
import { getDb } from "../lib/db.js";
import {
  getCategoriesCached,
  getGuildConfigCached,
} from "../lib/configCache.js";
import { buildContext } from "../lib/context.js";
import { createTicket, type FormAnswer } from "../lib/ticketManager.js";
import { hit } from "../lib/cooldown.js";
import { logger } from "../lib/logger.js";

type AnyInteraction =
  ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;

async function ephemeral(interaction: AnyInteraction, content: string) {
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
  } else {
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
}

function findCategory(
  guildId: string,
  categoryId: number,
): CategoryConfig | null {
  return getCategoriesCached(guildId).find((c) => c.id === categoryId) ?? null;
}

/** Entry point from the `open:` button and the `panelSelect:` menu. */
export async function startOpen(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  categoryId: number,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  const guildId = interaction.guildId!;
  const lang = getGuildConfigCached(guildId).language;
  const category = findCategory(guildId, categoryId);
  if (!category) {
    await ephemeral(interaction, t("ticket.open.noCategory", lang));
    return;
  }

  const guardMsg = openGuard(interaction.user.id, guildId, category, lang);
  if (guardMsg) {
    await ephemeral(interaction, guardMsg);
    return;
  }

  if (!hit(`open:${guildId}:${interaction.user.id}`, 20_000)) {
    await ephemeral(interaction, t("ticket.open.tooFast", lang));
    return;
  }

  if (category.form.length > 0) {
    // Tokens resolvable before the ticket exists: {user*}, {category*}, {guild*}.
    const fieldCtx = buildContext({
      guild: interaction.guild,
      opener: interaction.member,
      category,
    });
    const modal = new ModalBuilder()
      .setCustomId(`form:${category.id}`)
      .setTitle(`Open ${category.label}`.slice(0, 45));
    for (const field of category.form.slice(0, 5)) {
      const label =
        renderTemplate(field.label, fieldCtx) || field.label || "Answer";
      const input = new TextInputBuilder()
        .setCustomId(`field:${field.key}`)
        .setLabel(label.slice(0, 45))
        .setStyle(
          field.style === "paragraph"
            ? TextInputStyle.Paragraph
            : TextInputStyle.Short,
        )
        .setRequired(field.required);
      const ph = renderTemplate(field.placeholder, fieldCtx);
      if (ph) input.setPlaceholder(ph.slice(0, 100));
      if (field.minLength != null) input.setMinLength(field.minLength);
      if (field.maxLength != null) input.setMaxLength(field.maxLength);
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(input),
      );
    }
    await interaction.showModal(modal);
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await completeOpen(interaction, categoryId, []);
}

/** Shared guard checks (blacklist + limits). Returns an error string or null. */
function openGuard(
  userId: string,
  guildId: string,
  category: CategoryConfig,
  lang: string,
): string | null {
  const db = getDb();
  const guildConfig = getGuildConfigCached(guildId);
  if (guildConfig.suspended) {
    return t("ticket.open.suspended", lang);
  }
  if (category.disabled) {
    return t("ticket.open.categoryDisabled", lang, {
      category: category.label,
      reason: category.disabledReason || "Please check back later.",
    });
  }
  if (repos.blacklist.isBlacklisted(db, guildId, userId)) {
    return t("ticket.open.blacklisted", lang);
  }
  const globalOpen = repos.tickets.countOpenByUser(db, guildId, userId);
  if (globalOpen >= guildConfig.maxOpenPerUser) {
    return t("ticket.open.limitReached", lang, { count: globalOpen });
  }
  if (category.perUserLimit != null) {
    const catOpen = repos.tickets.countOpenByUser(
      db,
      guildId,
      userId,
      category.id,
    );
    if (catOpen >= category.perUserLimit) {
      return t("ticket.open.categoryLimitReached", lang, { count: catOpen });
    }
  }
  return null;
}

/** Finish creating the ticket. `interaction` is already deferred (ephemeral). */
export async function completeOpen(
  interaction:
    ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  categoryId: number,
  answers: FormAnswer[],
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  const guildId = interaction.guildId!;
  const guildConfig = getGuildConfigCached(guildId);
  const lang = guildConfig.language;
  const category = findCategory(guildId, categoryId);
  if (!category) {
    await interaction.editReply({ content: t("ticket.open.noCategory", lang) });
    return;
  }

  // Re-check guards (state may have changed while the modal was open).
  const guardMsg = openGuard(interaction.user.id, guildId, category, lang);
  if (guardMsg) {
    await interaction.editReply({ content: guardMsg });
    return;
  }

  try {
    const member = await interaction.guild!.members.fetch(interaction.user.id);
    const { channel } = await createTicket({
      guild: interaction.guild!,
      opener: member,
      category,
      guildConfig,
      answers,
    });
    await interaction.editReply({
      content: t("ticket.open.created", lang, { channel: `<#${channel.id}>` }),
    });
  } catch (err) {
    logger.error("createTicket failed", err);
    await interaction.editReply({ content: t("ticket.open.failed", lang) });
  }
}
