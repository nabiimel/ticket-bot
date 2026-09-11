import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { AudioPlayerStatus } from "@discordjs/voice";
import type { GuildQueue, Track } from "./queue.js";
import { fmtDuration } from "./format.js";

const BAR_SLOTS = 20;

function progressBar(queue: GuildQueue, track: Track): string {
  if (!track.durationSec || !queue.playingSince) return "";
  const elapsed = (Date.now() - queue.playingSince) / 1000;
  const ratio = Math.min(1, Math.max(0, elapsed / track.durationSec));
  const filled = Math.round(ratio * BAR_SLOTS);
  return (
    "▬".repeat(filled) + "🔘" + "▬".repeat(Math.max(0, BAR_SLOTS - filled))
  );
}

function buildEmbed(queue: GuildQueue, track: Track): EmbedBuilder {
  const paused = queue.player?.state.status === AudioPlayerStatus.Paused;
  const elapsedSec = queue.playingSince
    ? (Date.now() - queue.playingSince) / 1000
    : 0;
  const bar = progressBar(queue, track);

  const embed = new EmbedBuilder()
    .setAuthor({ name: paused ? "⏸️ Paused" : "▶️ Now Playing" })
    .setTitle(track.title)
    .setURL(track.url)
    .setColor(0x5865f2)
    .setDescription(
      bar
        ? `${bar}\n${fmtDuration(elapsedSec)} / ${fmtDuration(track.durationSec)}`
        : "🔴 Live / unknown duration",
    )
    .setFooter({
      text: `Requested by ${track.requestedByName} • Loop: ${queue.loop} • Volume: ${queue.volume}%`,
    });

  if (track.thumbnail) embed.setThumbnail(track.thumbnail);

  if (queue.tracks.length > 0) {
    const upNext = queue.tracks
      .slice(0, 5)
      .map((t, i) => `${i + 1}. ${t.title}`)
      .join("\n");
    embed.addFields({ name: "Up next", value: upNext.slice(0, 1024) });
  }

  return embed;
}

function buildButtons(
  queue: GuildQueue,
  guildId: string,
): ActionRowBuilder<ButtonBuilder> {
  const paused = queue.player?.state.status === AudioPlayerStatus.Paused;
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`music:${paused ? "resume" : "pause"}:${guildId}`)
      .setEmoji(paused ? "▶️" : "⏸️")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`music:skip:${guildId}`)
      .setEmoji("⏭️")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`music:stop:${guildId}`)
      .setEmoji("⏹️")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`music:loop:${guildId}`)
      .setEmoji("🔁")
      .setStyle(
        queue.loop === "off" ? ButtonStyle.Secondary : ButtonStyle.Success,
      ),
    new ButtonBuilder()
      .setCustomId(`music:shuffle:${guildId}`)
      .setEmoji("🔀")
      .setStyle(ButtonStyle.Secondary),
  );
}

/**
 * Post or refresh the single per-guild Now Playing message. Edits the
 * existing message in place by default (mirrors the ticket-claim button's
 * edit-in-place pattern); pass `forceNew` to always post a fresh message
 * (used by `!nowplaying` so it reappears at the bottom of the channel).
 */
export async function refreshNowPlaying(
  queue: GuildQueue,
  guildId: string,
  track: Track,
  opts: { forceNew?: boolean } = {},
): Promise<void> {
  const channel = queue.textChannel;
  if (!channel) return;
  const embed = buildEmbed(queue, track);
  const row = buildButtons(queue, guildId);

  if (!opts.forceNew && queue.nowPlayingMessage) {
    try {
      await queue.nowPlayingMessage.edit({
        embeds: [embed],
        components: [row],
      });
      return;
    } catch {
      queue.nowPlayingMessage = null;
    }
  }
  queue.nowPlayingMessage = await channel.send({
    embeds: [embed],
    components: [row],
  });
}
