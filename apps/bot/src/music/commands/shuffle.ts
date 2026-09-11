import type { PrefixCommand } from "../prefix.js";
import { shuffle as shuffleQueue } from "../../lib/music/player.js";
import { requireSameVoiceAsBot } from "../../lib/music/guards.js";
import { getExistingQueue } from "../../lib/music/queue.js";

export const shuffleCommand: PrefixCommand = {
  name: "shuffle",
  description: "Shuffle the upcoming queue.",
  async execute(message) {
    const queue = getExistingQueue(message.guildId);
    if (!queue || queue.tracks.length < 2) {
      await message.reply("Not enough tracks queued to shuffle.");
      return;
    }
    if (!(await requireSameVoiceAsBot(message))) return;
    shuffleQueue(message.guildId);
    await message.reply("🔀 Queue shuffled.");
  },
};
