import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  type Client,
  type Guild,
  type GuildMember,
  type TextChannel,
} from "discord.js";
import type {
  ApplicationConfig,
  ApplicationSubmission,
} from "@ticketbot/shared";
import { repos } from "@ticketbot/db";
import { getDb } from "./db.js";
import { buildEmbedWithAssets } from "./embedAssets.js";
import { buildContext } from "./context.js";
import { logger } from "./logger.js";

const DAY = 86_400_000;

/** Returns a human reason if the member can't apply, or null if they can. */
export function checkEligibility(
  app: ApplicationConfig,
  member: GuildMember,
): string | null {
  const e = app.eligibility;
  if (!e) return null;
  const now = Date.now();
  if (
    e.minAccountDays &&
    now - member.user.createdTimestamp < e.minAccountDays * DAY
  ) {
    return `Your Discord account must be at least ${e.minAccountDays} day(s) old to apply.`;
  }
  if (
    e.minMemberDays &&
    member.joinedTimestamp &&
    now - member.joinedTimestamp < e.minMemberDays * DAY
  ) {
    return `You must have been in this server for at least ${e.minMemberDays} day(s) to apply.`;
  }
  if (e.requiredRoleIds?.length) {
    const has = e.requiredRoleIds.some((r) => member.roles.cache.has(r));
    if (!has) return "You don't have the role required to apply.";
  }
  if (e.blockedRoleIds?.some((r) => member.roles.cache.has(r))) {
    return "You can't apply with your current roles.";
  }
  return null;
}

export function buildApplicationMessage(app: ApplicationConfig, guild: Guild) {
  const { embed, files } = buildEmbedWithAssets(
    app.embed,
    buildContext({ guild }),
  );
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`applyBtn:${app.id}`)
      .setLabel((app.buttonLabel || "Apply").slice(0, 80))
      .setStyle(ButtonStyle.Primary),
  );
  return { embeds: [embed], components: [row], files };
}

export function buildReviewCard(
  app: ApplicationConfig,
  sub: ApplicationSubmission,
  decided?: {
    status: "approved" | "denied";
    by: string;
    reason: string | null;
  },
) {
  const embed = new EmbedBuilder()
    .setColor(
      decided
        ? decided.status === "approved"
          ? 0x3ba55d
          : 0xed4245
        : 0x5865f2,
    )
    .setTitle(`${app.name} — application #${sub.id}`)
    .setDescription(`From <@${sub.userId}>`)
    .setTimestamp(sub.createdAt * 1000);

  for (const a of sub.answers.slice(0, 25)) {
    embed.addFields({
      name: a.label.slice(0, 256),
      value: (a.value || "—").slice(0, 1024),
    });
  }
  if (decided) {
    embed.addFields({
      name: decided.status === "approved" ? "✅ Approved" : "❌ Denied",
      value: `by <@${decided.by}>${decided.reason ? `\n${decided.reason}` : ""}`,
    });
    return { embeds: [embed], components: [] };
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`appDecide:${sub.id}:approve`)
      .setLabel("Approve")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`appDecide:${sub.id}:deny`)
      .setLabel("Deny")
      .setStyle(ButtonStyle.Danger),
  );
  return { embeds: [embed], components: [row] };
}

async function textChannel(
  guild: Guild,
  id: string | null | undefined,
): Promise<TextChannel | null> {
  if (!id) return null;
  const ch =
    guild.channels.cache.get(id) ??
    (await guild.channels.fetch(id).catch(() => null));
  return ch && ch.type === ChannelType.GuildText ? (ch as TextChannel) : null;
}

/**
 * Apply an approve/deny decision: grant roles, DM the applicant, update the
 * review card, log. Shared by the in-Discord buttons and the dashboard job.
 */
export async function applyDecision(
  client: Client,
  sub: ApplicationSubmission,
  decision: "approved" | "denied",
  reviewerId: string,
  reason: string | null,
): Promise<void> {
  const db = getDb();
  const app = repos.applications.getApplication(db, sub.applicationId);
  if (!app) return;
  const guild = client.guilds.cache.get(sub.guildId);
  if (!guild) return;

  repos.applications.decideSubmission(db, sub.id, decision, reviewerId, reason);

  if (decision === "approved" && app.grantRoleIds.length) {
    const member = await guild.members.fetch(sub.userId).catch(() => null);
    if (member) {
      await member.roles
        .add(app.grantRoleIds.filter((r) => guild.roles.cache.has(r)))
        .catch((err) => logger.warn("app role grant failed", sub.id, err));
    }
  }

  const user = await client.users.fetch(sub.userId).catch(() => null);
  if (user) {
    const msg =
      decision === "approved"
        ? `✅ Your **${app.name}** application in **${guild.name}** was approved.`
        : `❌ Your **${app.name}** application in **${guild.name}** was denied.${
            reason ? `\n> ${reason}` : ""
          }`;
    await user.send(msg).catch(() => null);
  }

  // Update the review card in place.
  if (sub.cardChannelId && sub.cardMessageId) {
    const ch = await textChannel(guild, sub.cardChannelId);
    const card = await ch?.messages.fetch(sub.cardMessageId).catch(() => null);
    if (card) {
      const fresh = repos.applications.getSubmission(db, sub.id)!;
      await card
        .edit(
          buildReviewCard(app, fresh, {
            status: decision,
            by: reviewerId,
            reason,
          }),
        )
        .catch(() => null);
    }
  }

  const logCh = await textChannel(guild, app.logChannelId);
  if (logCh) {
    await logCh
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(decision === "approved" ? 0x3ba55d : 0xed4245)
            .setDescription(
              `${decision === "approved" ? "✅ Approved" : "❌ Denied"} — ` +
                `**${app.name}** application #${sub.id} from <@${sub.userId}> by <@${reviewerId}>` +
                (reason ? `\nReason: ${reason}` : ""),
            )
            .setTimestamp(),
        ],
      })
      .catch(() => null);
  }
}
