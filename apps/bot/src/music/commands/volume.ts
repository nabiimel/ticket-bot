import type { PrefixCommand } from "../prefix.js";
import { setVolume } from "../../lib/music/player.js";
import { requireSameVoiceAsBot } from "../../lib/music/guards.js";
import { getExistingQueue } from "../../lib/music/queue.js";

export const volumeCommand: PrefixCommand = {
  name: "volume",
  aliases: ["vol"],
  description: "Set the playback volume (0-150).",
  async execute(message, args) {
    const queue = getExistingQueue(message.guildId);
    if (!queue) {
      await message.reply("I'm not playing anything.");
      return;
    }
    if (!args[0]) {
      await message.reply(`Current volume: **${queue.volume}%**`);
      return;
    }
    const pct = Number(args[0]);
    if (!Number.isFinite(pct) || pct < 0 || pct > 150) {
      await message.reply("Volume must be a number between 0 and 150.");
      return;
    }
    if (!(await requireSameVoiceAsBot(message))) return;
    const rounded = Math.round(pct);
    setVolume(message.guildId, rounded);
    await message.reply(`🔊 Volume set to **${rounded}%**.`);
  },
};
