import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  type GuildMember,
} from "discord.js";
import { repos } from "@ticketbot/db";
import type { ApplicationConfig } from "@ticketbot/shared";
import type { ButtonHandler, ModalHandler } from "../registry.js";
import { getDb } from "../lib/db.js";
import {
  applyDecision,
  buildReviewCard,
  checkEligibility,
} from "../lib/applications.js";
import { logger } from "../lib/logger.js";

function isReviewer(member: GuildMember, app: ApplicationConfig): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  return app.reviewerRoleIds.some((r) => member.roles.cache.has(r));
}

const applyButton: ButtonHandler = {
  prefix: "applyBtn",
  async run(interaction, args) {
    if (!interaction.inCachedGuild()) return;
    const app = repos.applications.getApplication(getDb(), Number(args[0]));
    if (!app || app.status !== "published") {
      await interaction.reply({
        content: "This application is not open.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const bad = checkEligibility(app, member);
    if (bad) {
      await interaction.reply({ content: bad, flags: MessageFlags.Ephemeral });
      return;
    }
    if (
      repos.applications.countOpenSubmissions(
        getDb(),
        app.id,
        interaction.user.id,
      ) >= app.maxOpenPerUser
    ) {
      await interaction.reply({
        content: "You already have an application awaiting review.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`appForm:${app.id}`)
      .setTitle(app.name.slice(0, 45));
    for (const f of app.questions.slice(0, 5)) {
      const input = new TextInputBuilder()
        .setCustomId(`field:${f.key}`)
        .setLabel((f.label || "Answer").slice(0, 45))
        .setStyle(
          f.style === "paragraph"
            ? TextInputStyle.Paragraph
            : TextInputStyle.Short,
        )
        .setRequired(f.required);
      if (f.placeholder) input.setPlaceholder(f.placeholder.slice(0, 100));
      if (f.minLength != null) input.setMinLength(f.minLength);
      if (f.maxLength != null) input.setMaxLength(f.maxLength);
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(input),
      );
    }
    await interaction.showModal(modal);
  },
};

const applyModal: ModalHandler = {
  prefix: "appForm",
  async run(interaction, args) {
    if (!interaction.inCachedGuild()) return;
    const db = getDb();
    const app = repos.applications.getApplication(db, Number(args[0]));
    if (!app) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const answers = app.questions.map((f) => ({
      key: f.key,
      label: f.label,
      value: interaction.fields.getTextInputValue(`field:${f.key}`).trim(),
    }));

    const sub = repos.applications.createSubmission(db, {
      applicationId: app.id,
      guildId: interaction.guildId,
      userId: interaction.user.id,
      answers,
    });

    // Post the review card to the log channel.
    const logId = app.logChannelId;
    const ch = logId
      ? ((await interaction.guild.channels.fetch(logId).catch(() => null)) ??
        null)
      : null;
    if (ch && ch.isTextBased()) {
      const ping = app.reviewerRoleIds.map((r) => `<@&${r}>`).join(" ");
      const card = await ch
        .send({
          content: ping || undefined,
          ...buildReviewCard(app, sub),
          allowedMentions: { roles: app.reviewerRoleIds },
        })
        .catch((err) => {
          logger.warn("review card post failed", sub.id, err);
          return null;
        });
      if (card) {
        repos.applications.setSubmissionCard(db, sub.id, ch.id, card.id);
      }
    }

    await interaction.editReply({
      content: `Your **${app.name}** application has been submitted for review.`,
    });
  },
};

const decideButton: ButtonHandler = {
  prefix: "appDecide",
  async run(interaction, args) {
    if (!interaction.inCachedGuild()) return;
    const [subIdRaw, action] = args;
    const db = getDb();
    const sub = repos.applications.getSubmission(db, Number(subIdRaw));
    if (!sub || sub.status !== "pending") {
      await interaction.reply({
        content: "That application has already been decided.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const app = repos.applications.getApplication(db, sub.applicationId);
    if (!app) return;
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!isReviewer(member, app)) {
      await interaction.reply({
        content: "You're not a reviewer for this application.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (action === "deny") {
      const modal = new ModalBuilder()
        .setCustomId(`appDeny:${sub.id}`)
        .setTitle("Deny application")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("reason")
              .setLabel("Reason (shared with the applicant)")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(false)
              .setMaxLength(1000),
          ),
        );
      await interaction.showModal(modal);
      return;
    }

    await interaction.deferUpdate();
    await applyDecision(
      interaction.client,
      sub,
      "approved",
      interaction.user.id,
      null,
    );
  },
};

const denyModal: ModalHandler = {
  prefix: "appDeny",
  async run(interaction, args) {
    if (!interaction.inCachedGuild()) return;
    const db = getDb();
    const sub = repos.applications.getSubmission(db, Number(args[0]));
    if (!sub || sub.status !== "pending") {
      await interaction.reply({
        content: "That application has already been decided.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const reason =
      interaction.fields.getTextInputValue("reason").trim() || null;
    await interaction.deferUpdate();
    await applyDecision(
      interaction.client,
      sub,
      "denied",
      interaction.user.id,
      reason,
    );
  },
};

export const applicationButtonHandlers: ButtonHandler[] = [
  applyButton,
  decideButton,
];
export const applicationModalHandlers: ModalHandler[] = [applyModal, denyModal];
