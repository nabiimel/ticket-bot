import { mkdirSync, writeFileSync } from "node:fs";
import {
  AttachmentBuilder,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type GuildTextBasedChannel,
  type Message,
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
import { buildRatingRow } from "./embeds.js";
import { buildEmbedWithAssets } from "./embedAssets.js";
import { buildTicketOverwrites, staffRoleIdsFor } from "./permissions.js";
import { buildControlsPayload, refreshTicketPipeline } from "./pipeline.js";
import { extractReservationFields } from "./reservationExtract.js";
import { hit } from "./cooldown.js";
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

  // Skip the manual "📌 Reserve" click when the buyer already told us this is
  // a reservation and the category's form is fully validated — see the
  // `is_reservation` synthetic answer folded in by completeOpen.
  let reservationCreated = false;
  if (
    category.askReservation &&
    (args.answers ?? []).find((a) => a.key === "is_reservation")?.value ===
      "Yes"
  ) {
    try {
      const fields = extractReservationFields(
        repos.tickets.getFormResponses(db, ticket.id),
      );
      repos.reservations.createReservation(db, {
        guildId: guild.id,
        ticketId: ticket.id,
        channelId: channel.id,
        buyerUserId: opener.id,
        buyerTag: opener.displayName || opener.user.username,
        gakuranName: fields.gakuranName,
        robloxUser: fields.robloxUser,
        qty: fields.qty,
        breakdown: fields.breakdown,
        addedBy: null,
      });
      repos.audit.logAudit(db, {
        guildId: guild.id,
        actorId: opener.id,
        action: "reservation.add",
        summary: `Auto-reserved for ${fields.gakuranName || opener.user.username}${fields.qty ? ` (${fields.qty} RR's)` : ""}`,
      });
      const budget = guildConfig.reservationsRobuxBudget;
      repos.jobs.enqueueJob(db, guild.id, "post_stock_update", {
        robux: budget,
        previous: budget,
      });
      reservationCreated = true;
    } catch (err) {
      logger.error("auto-reserve failed", ticket.id, err);
    }
  }

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
    allowedMentions: {
      users: [opener.id],
      roles: category.pingRoleIds,
    },
  });

  // The controls live in their own message, kept near the bottom of the
  // channel by keepControlsSticky, so only the buttons — not the welcome
  // embed / form responses — need to survive a long conversation.
  const controlsMsg = await channel.send(
    buildControlsPayload(ticket, guildConfig, { reserved: reservationCreated }),
  );
  repos.tickets.setControlsMessageId(db, ticket.id, controlsMsg.id);

  if (reservationCreated) {
    await channel
      .send({
        content: t("reservation.autoAdded", lang),
        allowedMentions: { parse: [] },
      })
      .catch(() => {});
  }

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

/**
 * Keep the Claim/Reserve/Close controls near the bottom of the channel by
 * deleting and resending the tracked controls message whenever a new message
 * has pushed it out of view. Throttled per ticket so a fast back-and-forth
 * doesn't turn into a delete+send pair on every single message.
 */
export async function keepControlsSticky(
  channel: GuildTextBasedChannel,
  ticket: TicketRecord,
  guildConfig: GuildConfig,
): Promise<void> {
  if (!ticket.controlsMessageId) return;
  if (!hit(`sticky-controls:${ticket.id}`, 20_000)) return;

  await channel.messages
    .fetch(ticket.controlsMessageId)
    .then((m) => m.delete())
    .catch(() => {});

  const controlsMsg = await channel
    .send(buildControlsPayload(ticket, guildConfig))
    .catch((err) => {
      logger.warn("keepControlsSticky: repost failed", ticket.id, err);
      return null;
    });
  if (controlsMsg) {
    repos.tickets.setControlsMessageId(getDb(), ticket.id, controlsMsg.id);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Plain-HTML fallback transcript (timestamp, author, text, attachment links —
 * no embeds/components/styling) used when the primary renderer throws, so a
 * library bug never means a ticket's history is silently lost. Content is
 * escaped since the dashboard serves transcript files as text/html.
 */
async function buildFallbackTranscript(
  channel: GuildTextBasedChannel,
  ticketNumber: number,
): Promise<Buffer> {
  const messages: Message[] = [];
  let before: string | undefined;
  for (let i = 0; i < 20; i++) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) break;
    messages.push(...batch.values());
    before = batch.last()?.id;
    if (batch.size < 100) break;
  }
  messages.reverse();

  const rows = messages
    .map((m) => {
      const author = escapeHtml(m.author?.tag ?? m.author?.id ?? "Unknown");
      const time = new Date(m.createdTimestamp).toISOString();
      const content = m.content
        ? escapeHtml(m.content)
        : "<i>(no text content)</i>";
      const attachments = [...m.attachments.values()]
        .map(
          (a) =>
            `<div class="attachment">📎 <a href="${escapeHtml(a.url)}">${escapeHtml(a.name ?? a.url)}</a></div>`,
        )
        .join("");
      const embedNote = m.embeds.length
        ? `<div class="note">[${m.embeds.length} embed(s) not shown in this simplified transcript]</div>`
        : "";
      return `<div class="msg"><div class="meta">${time} — <b>${author}</b></div><div class="content">${content}</div>${attachments}${embedNote}</div>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Ticket #${ticketNumber} transcript</title>
<style>
body{font-family:system-ui,sans-serif;background:#313338;color:#dbdee1;padding:16px;}
.msg{margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #3f4147;}
.meta{color:#949ba4;font-size:12px;}
.content{white-space:pre-wrap;word-break:break-word;}
.attachment,.note{color:#949ba4;font-size:12px;margin-top:4px;}
</style></head>
<body>
<p><i>Simplified transcript — the rich renderer failed for this ticket, so this is a plain fallback.</i></p>
${rows}
</body></html>`;

  return Buffer.from(html, "utf-8");
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
  } catch (err) {
    logger.error(
      "transcript generation failed, falling back to a plain transcript",
      err,
    );
    transcriptBuffer = await buildFallbackTranscript(
      channel,
      ticket.number,
    ).catch((fallbackErr) => {
      logger.error("fallback transcript generation also failed", fallbackErr);
      return null;
    });
  }
  if (transcriptBuffer) {
    mkdirSync(transcriptsDir(), { recursive: true });
    writeFileSync(transcriptsDir(ticket.id), transcriptBuffer);
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
  const closedTicket = repos.tickets.getTicket(db, ticket.id);
  if (closedTicket) {
    await refreshTicketPipeline(channel, closedTicket, guildConfig);
  }

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

/**
 * Toggle a ticket's paid status and relocate its channel accordingly (to
 * `paidCategoryId` when marking paid, back to the ticket's own category when
 * unmarking). Shared by the /ticket paid command, the dashboard's
 * admin_set_paid job, and the Reservations page's paid checkbox — moving
 * only the parent (no permissionOverwrites) leaves the channel's existing
 * access untouched. Posts a visible confirmation in the channel itself so
 * the change is equally noticeable regardless of which surface triggered it.
 * Also syncs the ticket's linked reservation (if any) so paid status stays
 * consistent whichever side — Tickets page, Reservations page, or Discord —
 * it was changed from.
 */
export async function setTicketPaid(
  guild: Guild,
  ticket: TicketRecord,
  paid: boolean,
  guildConfig: GuildConfig,
  actorId: string | null = null,
): Promise<{ moved: boolean; warning: string | null }> {
  const db = getDb();
  repos.tickets.setPaid(db, ticket.id, paid);

  const linkedReservation = repos.reservations.getByTicket(db, ticket.id);
  if (linkedReservation && linkedReservation.paid !== paid) {
    repos.reservations.updateReservation(db, linkedReservation.id, { paid });
  }

  const ch =
    guild.channels.cache.get(ticket.channelId) ??
    (await guild.channels.fetch(ticket.channelId).catch(() => null));
  if (!ch || ch.type !== ChannelType.GuildText) {
    return { moved: false, warning: "the ticket channel no longer exists" };
  }

  let moved = false;
  let warning: string | null = null;
  if (paid && !guildConfig.paidCategoryId) {
    warning = "no paid category is configured";
  } else {
    const category =
      ticket.categoryId != null
        ? repos.categories.getCategory(db, ticket.categoryId)
        : null;
    const targetParent = paid
      ? guildConfig.paidCategoryId
      : (category?.discordParentId ?? null);
    try {
      await (ch as TextChannel).edit({ parent: targetParent });
      moved = true;
    } catch (err) {
      logger.error("setTicketPaid: channel move failed", ticket.id, err);
      warning = "couldn't move the channel";
    }
  }

  const who = actorId ? ` by <@${actorId}>` : "";
  await (ch as TextChannel)
    .send({
      content: `${paid ? "💰 Marked as **paid**" : "Marked as **not paid**"}${who}${warning ? ` (${warning})` : ""}.`,
      allowedMentions: actorId ? { users: [actorId] } : undefined,
    })
    .catch((err) => logger.error("setTicketPaid: message post failed", err));

  await refreshTicketPipeline(ch as TextChannel, ticket, guildConfig, {
    paid,
  });

  return { moved, warning };
}
