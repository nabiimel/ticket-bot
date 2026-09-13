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
import {
  DEFAULT_RESERVATION_PROMPT,
  renderTemplate,
  t,
  type CategoryConfig,
} from "@ticketbot/shared";
import { repos } from "@ticketbot/db";
import { getDb } from "../lib/db.js";
import {
  getCategoriesCached,
  getGuildConfigCached,
} from "../lib/configCache.js";
import { buildContext } from "../lib/context.js";
import { buildReservationChoice } from "../lib/embeds.js";
import { createTicket, type FormAnswer } from "../lib/ticketManager.js";
import { hit } from "../lib/cooldown.js";
import { alertAdmins, preflightTicketCreate } from "../lib/preflight.js";
import { logger } from "../lib/logger.js";

/**
 * Users currently mid-creation, keyed by `guildId:userId`. A time-based cooldown
 * can't stop a fast double-click from racing two channels into existence before
 * the first ticket row lands; this can.
 */
const creating = new Set<string>();

/**
 * Which panel a user's in-progress open came from, keyed `guildId:userId`. Set
 * when they click, read when the ticket is created so we can credit the panel
 * with a conversion — the modal round-trip loses the panel id otherwise.
 */
const pendingPanel = new Map<
  string,
  { panelId: number; categoryId: number; at: number }
>();
const PENDING_TTL_MS = 5 * 60_000;

/**
 * The "is this a reservation?" answer, keyed `guildId:userId`, remembered
 * across the modal round-trip the same way `pendingPanel` remembers the
 * panel id — read (and cleared) by `completeOpen` so it can be folded into
 * the ticket's form responses regardless of whether the category has a form.
 */
const pendingReservationChoice = new Map<string, boolean>();

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

/** Builds the intake-form modal for a category (up to 5 fields, Discord's cap). */
function buildFormModal(
  category: CategoryConfig,
  interaction:
    ButtonInteraction<"cached"> | StringSelectMenuInteraction<"cached">,
): ModalBuilder {
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
    // Discord's modal text inputs have no numeric-only mode, so hint it in
    // the placeholder — the actual rule is enforced on submit (modals.ts).
    const ph =
      renderTemplate(field.placeholder, fieldCtx) ||
      (field.validation === "numeric" ? "Numbers only" : undefined);
    if (ph) input.setPlaceholder(ph.slice(0, 100));
    if (field.minLength != null) input.setMinLength(field.minLength);
    if (field.maxLength != null) input.setMaxLength(field.maxLength);
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(input),
    );
  }
  return modal;
}

/** Merges a category's prompt overrides onto the defaults and renders tokens. */
function resolveReservationPrompt(
  category: CategoryConfig,
  interaction:
    ButtonInteraction<"cached"> | StringSelectMenuInteraction<"cached">,
) {
  const merged = {
    ...DEFAULT_RESERVATION_PROMPT,
    ...(category.reservationPrompt ?? {}),
  };
  const fieldCtx = buildContext({
    guild: interaction.guild,
    opener: interaction.member,
    category,
  });
  return {
    title: renderTemplate(merged.title, fieldCtx) || merged.title,
    body: renderTemplate(merged.body, fieldCtx) || merged.body,
    yesLabel: merged.yesLabel,
    noLabel: merged.noLabel,
  };
}

/** Entry point from the `open:` button and the `panelSelect:` menu. */
export async function startOpen(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  categoryId: number,
  panelId: number | null = null,
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

  // Panel analytics: count the click and remember it for the conversion credit.
  if (panelId != null) {
    const key = `${guildId}:${interaction.user.id}`;
    try {
      repos.panelStats.bumpClick(getDb(), panelId, categoryId);
    } catch {
      /* stats are best-effort */
    }
    pendingPanel.set(key, { panelId, categoryId, at: Date.now() });
  }

  if (category.askReservation) {
    const prompt = resolveReservationPrompt(category, interaction);
    await interaction.reply({
      content: `**${prompt.title}**\n${prompt.body}`,
      components: [buildReservationChoice(categoryId, panelId, prompt)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (category.form.length > 0) {
    await interaction.showModal(buildFormModal(category, interaction));
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await completeOpen(interaction, categoryId, []);
}

/** Entry point from the reservationChoice:<categoryId>:<yes|no>:<panelId?> buttons. */
export async function handleReservationChoice(
  interaction: ButtonInteraction,
  categoryId: number,
  panelId: number | null,
  isReservation: boolean,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  const guildId = interaction.guildId!;
  const lang = getGuildConfigCached(guildId).language;
  const category = findCategory(guildId, categoryId);
  if (!category) {
    await ephemeral(interaction, t("ticket.open.noCategory", lang));
    return;
  }

  // Re-check guards — state may have changed since the original click.
  const guardMsg = openGuard(interaction.user.id, guildId, category, lang);
  if (guardMsg) {
    await interaction.update({ content: guardMsg, components: [] });
    return;
  }

  const lockKey = `${guildId}:${interaction.user.id}`;
  pendingReservationChoice.set(lockKey, isReservation);

  if (category.form.length > 0) {
    await interaction.showModal(buildFormModal(category, interaction));
    return;
  }

  await interaction.deferUpdate();
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

  // Fold in the "is this a reservation?" answer, if this category asked one.
  const choiceKey = `${guildId}:${interaction.user.id}`;
  const reservationChoice = pendingReservationChoice.get(choiceKey);
  if (reservationChoice !== undefined) {
    pendingReservationChoice.delete(choiceKey);
    answers = [
      {
        key: "is_reservation",
        label: t("ticket.open.reservationAnswer.label", lang),
        value: reservationChoice ? "Yes" : "No",
      },
      ...answers,
    ];
  }

  // Re-check guards (state may have changed while the modal was open).
  const guardMsg = openGuard(interaction.user.id, guildId, category, lang);
  if (guardMsg) {
    await interaction.editReply({ content: guardMsg });
    return;
  }

  // One creation at a time per user — blocks the double-click channel race.
  const lockKey = `${guildId}:${interaction.user.id}`;
  if (creating.has(lockKey)) {
    await interaction.editReply({
      content: t("ticket.open.inProgress", lang),
    });
    return;
  }

  // Catch config/capacity problems before Discord throws, and tell staff.
  const pre = preflightTicketCreate(interaction.guild!, category);
  if (!pre.ok) {
    await interaction.editReply({
      content: t(pre.userKey ?? "ticket.open.failed", lang),
    });
    if (pre.adminMessage) {
      void alertAdmins(
        interaction.guild!,
        guildConfig,
        `Ticket open blocked for <@${interaction.user.id}> (“${category.label}”): ${pre.adminMessage}`,
      );
    }
    return;
  }

  creating.add(lockKey);
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

    // Panel analytics: credit the click that led here with a conversion.
    const pend = pendingPanel.get(lockKey);
    if (
      pend &&
      pend.categoryId === categoryId &&
      Date.now() - pend.at < PENDING_TTL_MS
    ) {
      try {
        repos.panelStats.bumpOpen(getDb(), pend.panelId, categoryId);
      } catch {
        /* best-effort */
      }
    }
  } catch (err) {
    logger.error("createTicket failed", err);
    await interaction.editReply({ content: t("ticket.open.failed", lang) });
    void alertAdmins(
      interaction.guild!,
      guildConfig,
      `A ticket failed to open for <@${interaction.user.id}> (“${category.label}”): \`${String(
        err,
      ).slice(0, 300)}\``,
    );
  } finally {
    creating.delete(lockKey);
    pendingPanel.delete(lockKey);
  }
}
