import type { PrefixCommand } from "../prefix.js";
import { skip as skipTrack } from "../../lib/music/player.js";
import { requireSameVoiceAsBot } from "../../lib/music/guards.js";
import { getExistingQueue } from "../../lib/music/queue.js";

export const skipCommand: PrefixCommand = {
  name: "skip",
  aliases: ["s"],
  description: "Skip the current track.",
  async execute(message) {
    const queue = getExistingQueue(message.guildId);
    if (!queue?.current) {
      await message.reply("Nothing is playing.");
      return;
    }
    if (!(await requireSameVoiceAsBot(message))) return;
    const title = queue.current.title;
    skipTrack(message.guildId);
    await message.reply(`⏭️ Skipped **${title}**.`);
  },
};
