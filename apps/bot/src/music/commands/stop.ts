import type { PrefixCommand } from "../prefix.js";
import { stop as stopPlayback } from "../../lib/music/player.js";
import { requireSameVoiceAsBot } from "../../lib/music/guards.js";
import { getExistingQueue } from "../../lib/music/queue.js";

export const stopCommand: PrefixCommand = {
  name: "stop",
  description: "Stop playback, clear the queue, and leave the voice channel.",
  async execute(message) {
    if (!getExistingQueue(message.guildId)) {
      await message.reply("I'm not playing anything.");
      return;
    }
    if (!(await requireSameVoiceAsBot(message))) return;
    stopPlayback(message.guildId);
    await message.reply("⏹️ Stopped and left the voice channel.");
  },
};
