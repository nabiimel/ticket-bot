import type { PrefixCommand } from "../prefix.js";
import { clearQueue } from "../../lib/music/player.js";
import { requireSameVoiceAsBot } from "../../lib/music/guards.js";
import { getExistingQueue } from "../../lib/music/queue.js";

export const clearCommand: PrefixCommand = {
  name: "clear",
  description: "Clear the upcoming queue (keeps the current track playing).",
  async execute(message) {
    const queue = getExistingQueue(message.guildId);
    if (!queue || queue.tracks.length === 0) {
      await message.reply("The queue is already empty.");
      return;
    }
    if (!(await requireSameVoiceAsBot(message))) return;
    const n = clearQueue(message.guildId);
    await message.reply(`Cleared **${n}** track(s) from the queue.`);
  },
};
