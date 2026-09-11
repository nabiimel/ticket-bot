import { MessageFlags } from "discord.js";
import type { ButtonHandler } from "../registry.js";
import { getExistingQueue } from "../lib/music/queue.js";
import {
  pause,
  resume,
  skip,
  stop,
  cycleLoop,
  shuffle,
} from "../lib/music/player.js";

export const musicButtonHandler: ButtonHandler = {
  prefix: "music",
  async run(interaction, args) {
    const [action, guildId] = args;
    if (
      !guildId ||
      !interaction.inCachedGuild() ||
      interaction.guildId !== guildId
    ) {
      return;
    }

    const botChannelId = interaction.guild.members.me?.voice.channelId;
    const memberChannelId = interaction.member.voice.channelId;
    if (!botChannelId || memberChannelId !== botChannelId) {
      await interaction.reply({
        content: "Join the same voice channel to control playback.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const queue = getExistingQueue(guildId);
    if (!queue) {
      await interaction.reply({
        content: "I'm not playing anything anymore.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    switch (action) {
      case "pause":
        pause(guildId);
        break;
      case "resume":
        resume(guildId);
        break;
      case "skip":
        skip(guildId);
        break;
      case "stop":
        stop(guildId);
        break;
      case "loop":
        cycleLoop(guildId);
        break;
      case "shuffle":
        shuffle(guildId);
        break;
      default:
        return;
    }
    await interaction.deferUpdate();
  },
};
