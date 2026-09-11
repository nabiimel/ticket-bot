import type { PrefixCommand } from "../prefix.js";
import { removeAt } from "../../lib/music/player.js";
import { requireSameVoiceAsBot } from "../../lib/music/guards.js";
import { getExistingQueue } from "../../lib/music/queue.js";

export const removeCommand: PrefixCommand = {
  name: "remove",
  aliases: ["rm"],
  description: "Remove a track from the queue by position.",
  async execute(message, args) {
    const queue = getExistingQueue(message.guildId);
    if (!queue || queue.tracks.length === 0) {
      await message.reply("The queue is empty.");
      return;
    }
    const position = Number(args[0]);
    if (!Number.isInteger(position)) {
      await message.reply("Usage: `!remove <position>` (see `!queue`)");
      return;
    }
    if (!(await requireSameVoiceAsBot(message))) return;
    const removed = removeAt(message.guildId, position);
    if (!removed) {
      await message.reply("No track at that position.");
      return;
    }
    await message.reply(`Removed **${removed.title}**.`);
  },
};
