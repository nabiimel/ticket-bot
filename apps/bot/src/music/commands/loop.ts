import type { PrefixCommand } from "../prefix.js";
import { setLoop, cycleLoop } from "../../lib/music/player.js";
import { requireSameVoiceAsBot } from "../../lib/music/guards.js";
import { getExistingQueue, type LoopMode } from "../../lib/music/queue.js";

const MODES: LoopMode[] = ["off", "track", "queue"];

export const loopCommand: PrefixCommand = {
  name: "loop",
  description: "Set loop mode: off, track, or queue (no argument cycles).",
  async execute(message, args) {
    const queue = getExistingQueue(message.guildId);
    if (!queue) {
      await message.reply("I'm not playing anything.");
      return;
    }
    if (!(await requireSameVoiceAsBot(message))) return;

    const arg = args[0]?.toLowerCase();
    let mode: LoopMode | null;
    if (!arg) {
      mode = cycleLoop(message.guildId);
    } else if ((MODES as string[]).includes(arg)) {
      mode = arg as LoopMode;
      setLoop(message.guildId, mode);
    } else {
      await message.reply("Usage: `!loop <off|track|queue>`");
      return;
    }
    await message.reply(`🔁 Loop mode: **${mode}**.`);
  },
};
