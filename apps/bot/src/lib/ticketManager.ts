import { mkdirSync, writeFileSync } from "node:fs";
import {
  AttachmentBuilder,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type GuildTextBasedChannel,
  type TextChannel,
  type User,
} from "discord.js";
import { createTranscript, ExportReturnType } from "discord-html-transcripts";
import {
  DEFAULT_CLOSE_EMBED,
  DEFAULT_FEEDBACK_EMBED,
  DEFAULT_WELCOME_EMBED,
  t,
  type CategoryConfig,
  type GuildConfig,
  type TicketRecord,
} from "@ticketbot/shared";
import { repos, transcriptsDir } from "@ticketbot/db";
import { getDb } from "./db.js";
import { buildContext } from "./context.js";
import { buildRatingRow, buildTicketControls } from "./embeds.js";
import { buildEmbedWithAssets } from "./embedAssets.js";
import { buildTicketOverwrites, staffRoleIdsFor } from "./permissions.js";
import { logger } from "./logger.js";

export interface FormAnswer {
  key: string;
  label: string;
  value: string;
}

/** Add {form.<key>} tokens plus {form.all} to a template context. */
export function injectFormTokens(
  ctx: Record<string, string | number | undefined>,
  answers: FormAnswer[],
): void {
  for (const a of answers) ctx[`form.${a.key}`] = a.value || "—";
  if (answers.length) {
    ctx["form.all"] = answers
      .map((a) => `**${a.label}:** ${a.value || "—"}`)
      .join("\n");
  }
}

function channelName(
  scheme: string,
  number: number,
  opener: GuildMember,
  categoryKey: string,
  answers: FormAnswer[],
): string {
  const raw = scheme
    .replace(/\{number\}/g, String(number))
    .replace(/\{(username|user)\}/g, opener.user.username)
    .replace(/\{id\}/g, opener.id)
    .replace(/\{category\}/g, categoryKey)
    .replace(/\{form\.([a-zA-Z0-9_]+)\}/g, (_m, key: string) => {
      const a = answers.find((x) => x.key === key);
      return a ? a.value.slice(0, 30) : "";
    });
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 95) || `ticket-${number}`
  );
}

async function fetchTextChannel(
  guild: Guild,
  id: string | null,
): Promise<TextChannel | null> {
  if (!id) return null;
  const ch =
    guild.channels.cache.get(id) ??
    (await guild.channels.fetch(id).catch(() => null));
  return ch && ch.type === ChannelType.GuildText ? (ch as TextChannel) : null;
}

export interface CreateTicketResult {
  ticket: TicketRecord;
  channel: TextChannel;
}

/** Create the ticket channel, persist it, post the welcome message, log it. */
export async function createTicket(args: {
  guild: Guild;
  opener: GuildMember;
  category: CategoryConfig;
  guildConfig: GuildConfig;
  answers?: FormAnswer[];
}): Promise<CreateTicketResult> {
  const { guild, opener, category, guildConfig } = args;
  const db = getDb();
  const lang = guildConfig.language;

  const number = repos.counter.nextTicketNumber(db, guild.id);
  const staffRoleIds = staffRoleIdsFor(guildConfig, category);

  const parent =
    category.discordParentId &&
    guild.channels.cache.get(category.discordParentId)?.type ===
      ChannelType.GuildCategory
      ? category.discordParentId
      : undefined;

  const channel = await guild.channels.create({
    name: channelName(
      category.namingScheme ?? guildConfig.namingScheme,
      number,
      opener,
      category.key,
      args.answers ?? [],
    ),
    type: ChannelType.GuildText,
    parent,
    topic: `Ticket #${number} • ${category.label} • opened by ${opener.user.tag} (${opener.id})`,
    permissionOverwrites: buildTicketOverwrites(guild, opener.id, staffRoleIds),
  });

  const ticket = repos.tickets.createTicket(db, {
    guildId: guild.id,
    number,
    channelId: channel.id,
    categoryId: category.id,
    openerId: opener.id,
    formResponses: (args.answers ?? []).map((a) => ({
      fieldKey: a.key,
      fieldLabel: a.label,
      value: a.value,
    })),
  });

  const ctx = buildContext({ guild, opener, category, ticket });
  injectFormTokens(ctx, args.answers ?? []);

  const welcomeCfg =
    category.welcomeEmbed ?? guildConfig.welcomeEmbed ?? DEFAULT_WELCOME_EMBED;
  const { embed: welcome, files: welcomeFiles } = buildEmbedWithAssets(
    welcomeCfg,
    ctx,
  );

  const embeds: EmbedBuilder[] = [welcome];
  if (args.answers?.length) {
    const formEmbed = new EmbedBuilder()
      .setTitle("Form responses")
      .setColor(welcome.data.color ?? null);
    for (const a of args.answers.slice(0, 25)) {
      formEmbed.addFields({
        name: a.label.slice(0, 256),
        value: (a.value || "—").slice(0, 1024),
      });
    }
    embeds.push(formEmbed);
  }

  const pingContent = [
    `<@${opener.id}>`,
    ...category.pingRoleIds.map((r) => `<@&${r}>`),
  ].join(" ");

  await channel.send({
    content: pingContent || undefined,
    embeds,
    files: welcomeFiles,
    components: [
      buildTicketControls(ticket.id, {
        claimEnabled: guildConfig.claimingEnabled,
      }),
    ],
    allowedMentions: {
      users: [opener.id],
      roles: category.pingRoleIds,
    },
  });

  const logCh = await fetchTextChannel(guild, guildConfig.logChannelId);
  if (logCh) {
    await logCh
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setDescription(
              t("ticket.log.opened", lang, {
                "ticket.number": number,
                "user.tag": opener.user.tag,
                "category.name": category.label,
              }),
            )
            .addFields(
              { name: "Channel", value: `${channel}`, inline: true },
              { name: "Opened by", value: `<@${opener.id}>`, inline: true },
            )
            .setTimestamp(),
        ],
      })
      .catch(() => null);
  }

  return { ticket, channel };
}

/** Generate a transcript, notify the opener, log, then delete/archive the channel. */
export async function closeTicket(args: {
  guild: Guild;
  channel: GuildTextBasedChannel;
  ticket: TicketRecord;
  closedBy: User;
  reason: string | null;
  guildConfig: GuildConfig;
}): Promise<void> {
  const { guild, channel, ticket, closedBy, reason, guildConfig } = args;
  const db = getDb();
  const lang = guildConfig.language;
  const category =
    ticket.categoryId != null
      ? repos.categories.getCategory(db, ticket.categoryId)
      : null;

  // 1. Transcript
  let transcriptUrl: string | null = null;
  let transcriptBuffer: Buffer | null = null;
  const transcriptName = `ticket-${ticket.number}.html`;
  const file = () =>
    transcriptBuffer
      ? new AttachmentBuilder(transcriptBuffer, { name: transcriptName })
      : null;
  try {
    // discord-html-transcripts ships its own copy of the discord.js types
    // (resolution-mode: import), so the channel arg needs a cast here.
    transcriptBuffer = (await createTranscript(channel as never, {
      returnType: ExportReturnType.Buffer,
      filename: transcriptName,
      poweredBy: false,
      saveImages: true,
    })) as Buffer;
    mkdirSync(transcriptsDir(), { recursive: true });
    writeFileSync(transcriptsDir(ticket.id), transcriptBuffer);
  } catch (err) {
    logger.error("transcript generation failed", err);
  }

  // 2. Post transcript to the transcript channel
  const transcriptCh = await fetchTextChannel(
    guild,
    guildConfig.transcriptChannelId ?? guildConfig.logChannelId,
  );
  const opener = await guild.members.fetch(ticket.openerId).catch(() => null);
  const ctx = buildContext({
    guild,
    opener: opener ?? undefined,
    category,
    ticket,
    claimedBy: closedBy,
    reason,
  });
  ctx["closed_by"] = closedBy.username;
  ctx["closed_by.tag"] = `@${closedBy.username}`;
  injectFormTokens(
    ctx,
    repos.tickets.getFormResponses(db, ticket.id).map((r) => ({
      key: r.fieldKey,
      label: r.fieldLabel,
      value: r.value,
    })),
  );

  const transcriptFile = file();
  if (transcriptCh && transcriptFile) {
    const msg = await transcriptCh
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle(`Ticket #${ticket.number} — transcript`)
            .addFields(
              {
                name: "Opened by",
                value: `<@${ticket.openerId}>`,
                inline: true,
              },
              { name: "Closed by", value: `<@${closedBy.id}>`, inline: true },
              {
                name: "Reason",
                value: reason || "No reason given",
                inline: false,
              },
            )
            .setTimestamp(),
        ],
        files: [transcriptFile],
      })
      .catch(() => null);
    transcriptUrl = msg?.attachments.first()?.url ?? msg?.url ?? null;
  }

  // 3. Persist
  repos.tickets.markClosed(db, ticket.id, closedBy.id, reason, transcriptUrl);

  // 4. DM the opener (close embed + feedback prompt)
  if (opener) {
    const { embed: closeEmbed, files: closeFiles } = buildEmbedWithAssets(
      guildConfig.closeEmbed ?? DEFAULT_CLOSE_EMBED,
      ctx,
    );
    // Attach the transcript to the DM only if we couldn't post a link to it.
    const dmFile = !transcriptUrl ? file() : null;
    const dmFiles = [...closeFiles, ...(dmFile ? [dmFile] : [])];
    const dm = await opener.createDM().catch(() => null);
    if (dm) {
      await dm
        .send({
          embeds: [closeEmbed],
          components: [],
          files: dmFiles,
        })
        .catch(() => null);
      if (transcriptUrl) {
        await dm
          .send({
            content: `${t("ticket.close.transcriptLink", lang)}: ${transcriptUrl}`,
          })
          .catch(() => null);
      }
      if (guildConfig.feedbackEnabled) {
        const { embed: fb, files: fbFiles } = buildEmbedWithAssets(
          guildConfig.feedbackPromptEmbed ?? DEFAULT_FEEDBACK_EMBED,
          ctx,
        );
        await dm
          .send({
            embeds: [fb],
            components: [buildRatingRow(ticket.id)],
            files: fbFiles,
          })
          .catch(() => null);
      }
    }
  }

  // 5. Log
  const logCh = await fetchTextChannel(guild, guildConfig.logChannelId);
  if (logCh) {
    await logCh
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setDescription(
              t("ticket.log.closed", lang, {
                "ticket.number": ticket.number,
                "closed_by.tag": closedBy.tag,
              }),
            )
            .addFields(
              { name: "Reason", value: reason || "No reason given" },
              ...(transcriptUrl
                ? [{ name: "Transcript", value: transcriptUrl }]
                : []),
            )
            .setTimestamp(),
        ],
      })
      .catch(() => null);
  }

  // 6. Delete or archive the channel
  if (
    guildConfig.closeBehaviour === "archive" &&
    guildConfig.archiveCategoryId
  ) {
    // Keep staff read access to archived tickets; nobody can send.
    const staffRoleIds = staffRoleIdsFor(guildConfig, category);
    const overwrites = [
      { id: guild.roles.everyone.id, deny: PermissionFlagsBits.ViewChannel },
      ...staffRoleIds
        .filter((id) => guild.roles.cache.has(id))
        .map((id) => ({
          id,
          allow:
            PermissionFlagsBits.ViewChannel |
            PermissionFlagsBits.ReadMessageHistory,
          deny: PermissionFlagsBits.SendMessages,
        })),
      ...(guild.members.me
        ? [
            {
              id: guild.members.me.id,
              allow:
                PermissionFlagsBits.ViewChannel |
                PermissionFlagsBits.SendMessages |
                PermissionFlagsBits.ManageChannels,
            },
          ]
        : []),
    ];
    await channel
      .edit({
        parent: guildConfig.archiveCategoryId,
        permissionOverwrites: overwrites,
      })
      .catch((err) => logger.error("archive failed", err));
  } else {
    setTimeout(() => {
      channel
        .delete("Ticket closed")
        .catch((err) => logger.error("delete failed", err));
    }, 5000);
  }
}
