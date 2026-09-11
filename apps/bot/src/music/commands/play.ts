import { PermissionFlagsBits } from "discord.js";
import type { PrefixCommand } from "../prefix.js";
import { resolveQuery } from "../../lib/music/search.js";
import { enqueue } from "../../lib/music/player.js";
import { resolveMember } from "../../lib/music/guards.js";
import { logger } from "../../lib/logger.js";
import {
  isSpotifyPlaylistOrAlbumUrl,
  isSpotifyTrackUrl,
  resolveSpotifyTrackQuery,
} from "../../lib/music/spotify.js";

export const playCommand: PrefixCommand = {
  name: "play",
  aliases: ["p"],
  description: "Play a song by search term or URL.",
  async execute(message, args) {
    let query = args.join(" ").trim();
    if (!query) {
      await message.reply("Usage: `!play <song name or URL>`");
      return;
    }

    if (isSpotifyPlaylistOrAlbumUrl(query)) {
      await message.reply(
        "Spotify playlists and albums aren't supported yet — try a track link instead.",
      );
      return;
    }
    if (isSpotifyTrackUrl(query)) {
      const resolved = await resolveSpotifyTrackQuery(query);
      if (!resolved) {
        await message.reply("Couldn't resolve that Spotify link.");
        return;
      }
      query = resolved;
    }

    const member = await resolveMember(message);
    const voiceChannel = member?.voice.channel;
    if (!voiceChannel) {
      await message.reply("Join a voice channel first.");
      return;
    }

    const me = message.guild.members.me;
    if (
      me &&
      !voiceChannel
        .permissionsFor(me)
        ?.has(PermissionFlagsBits.Connect | PermissionFlagsBits.Speak)
    ) {
      await message.reply(
        "I don't have permission to join/speak in that voice channel.",
      );
      return;
    }

    const loading = await message.reply("🔎 Searching...");
    const resolved = await resolveQuery(query);
    if (resolved.length === 0) {
      await loading.edit("Couldn't find anything for that.");
      return;
    }

    const tracks = resolved.map((t) => ({
      ...t,
      requestedByName: member.displayName,
    }));

    try {
      const { startedImmediately } = await enqueue(
        voiceChannel,
        message.channel,
        tracks,
      );
      if (!startedImmediately) {
        await loading.edit(
          tracks.length === 1
            ? `Queued **${tracks[0]!.title}**.`
            : `Queued **${tracks.length}** tracks.`,
        );
      } else {
        await loading.delete().catch(() => {});
      }
    } catch (err) {
      logger.error("play command failed", err);
      await loading.edit("Something went wrong trying to play that.");
    }
  },
};
