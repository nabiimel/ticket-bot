import type { PrefixCommand } from "../prefix.js";
import { resume as resumePlayback } from "../../lib/music/player.js";
import { requireSameVoiceAsBot } from "../../lib/music/guards.js";
import { getExistingQueue } from "../../lib/music/queue.js";

export const resumeCommand: PrefixCommand = {
  name: "resume",
  description: "Resume playback.",
  async execute(message) {
    const queue = getExistingQueue(message.guildId);
    if (!queue?.current) {
      await message.reply("Nothing is playing.");
      return;
    }
    if (!(await requireSameVoiceAsBot(message))) return;
    resumePlayback(message.guildId);
    await message.reply("▶️ Resumed.");
  },
};
