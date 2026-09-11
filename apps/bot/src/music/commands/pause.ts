import type { PrefixCommand } from "../prefix.js";
import { pause as pausePlayback } from "../../lib/music/player.js";
import { requireSameVoiceAsBot } from "../../lib/music/guards.js";
import { getExistingQueue } from "../../lib/music/queue.js";

export const pauseCommand: PrefixCommand = {
  name: "pause",
  description: "Pause playback.",
  async execute(message) {
    const queue = getExistingQueue(message.guildId);
    if (!queue?.current) {
      await message.reply("Nothing is playing.");
      return;
    }
    if (!(await requireSameVoiceAsBot(message))) return;
    pausePlayback(message.guildId);
    await message.reply("⏸️ Paused.");
  },
};
