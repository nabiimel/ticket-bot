import type { PrefixCommand } from "../prefix.js";
import { disconnect } from "../../lib/music/player.js";
import { requireSameVoiceAsBot } from "../../lib/music/guards.js";
import { getExistingQueue } from "../../lib/music/queue.js";

export const disconnectCommand: PrefixCommand = {
  name: "disconnect",
  aliases: ["dc", "leave"],
  description: "Leave the voice channel.",
  async execute(message) {
    if (!getExistingQueue(message.guildId)) {
      await message.reply("I'm not in a voice channel.");
      return;
    }
    if (!(await requireSameVoiceAsBot(message))) return;
    disconnect(message.guildId);
    await message.reply("👋 Disconnected.");
  },
};
