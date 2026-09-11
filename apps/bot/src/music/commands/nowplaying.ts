import type { PrefixCommand } from "../prefix.js";
import { getExistingQueue } from "../../lib/music/queue.js";
import { refreshNowPlaying } from "../../lib/music/nowPlaying.js";

export const nowPlayingCommand: PrefixCommand = {
  name: "nowplaying",
  aliases: ["np"],
  description: "Re-post the Now Playing message.",
  async execute(message) {
    const queue = getExistingQueue(message.guildId);
    if (!queue?.current) {
      await message.reply("Nothing is playing.");
      return;
    }
    queue.textChannel = message.channel;
    await refreshNowPlaying(queue, message.guildId, queue.current, {
      forceNew: true,
    });
  },
};
