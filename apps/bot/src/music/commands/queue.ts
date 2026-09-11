import { EmbedBuilder } from "discord.js";
import type { PrefixCommand } from "../prefix.js";
import { getExistingQueue } from "../../lib/music/queue.js";
import { fmtDuration } from "../../lib/music/format.js";

export const queueCommand: PrefixCommand = {
  name: "queue",
  aliases: ["q"],
  description: "Show the upcoming queue.",
  async execute(message) {
    const queue = getExistingQueue(message.guildId);
    if (!queue || (!queue.current && queue.tracks.length === 0)) {
      await message.reply("The queue is empty.");
      return;
    }

    const embed = new EmbedBuilder().setTitle("Queue").setColor(0x5865f2);
    if (queue.current) {
      embed.addFields({
        name: "Now playing",
        value: `${queue.current.title} (${fmtDuration(queue.current.durationSec)})`,
      });
    }
    if (queue.tracks.length > 0) {
      const shown = queue.tracks.slice(0, 10);
      embed.addFields({
        name: "Up next",
        value: shown
          .map((t, i) => `${i + 1}. ${t.title} (${fmtDuration(t.durationSec)})`)
          .join("\n")
          .slice(0, 1024),
      });
      if (queue.tracks.length > shown.length) {
        embed.setFooter({
          text: `and ${queue.tracks.length - shown.length} more`,
        });
      }
    }

    await message.reply({ embeds: [embed] });
  },
};
