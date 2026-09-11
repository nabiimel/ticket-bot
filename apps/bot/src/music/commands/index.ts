import type { PrefixCommand } from "../prefix.js";
import { playCommand } from "./play.js";
import { skipCommand } from "./skip.js";
import { stopCommand } from "./stop.js";
import { pauseCommand } from "./pause.js";
import { resumeCommand } from "./resume.js";
import { queueCommand } from "./queue.js";
import { nowPlayingCommand } from "./nowplaying.js";
import { volumeCommand } from "./volume.js";
import { loopCommand } from "./loop.js";
import { shuffleCommand } from "./shuffle.js";
import { removeCommand } from "./remove.js";
import { clearCommand } from "./clear.js";
import { disconnectCommand } from "./disconnect.js";

export const musicCommands: PrefixCommand[] = [
  playCommand,
  skipCommand,
  stopCommand,
  pauseCommand,
  resumeCommand,
  queueCommand,
  nowPlayingCommand,
  volumeCommand,
  loopCommand,
  shuffleCommand,
  removeCommand,
  clearCommand,
  disconnectCommand,
];

export const musicCommandMap = new Map<string, PrefixCommand>();
for (const cmd of musicCommands) {
  musicCommandMap.set(cmd.name, cmd);
  for (const alias of cmd.aliases ?? []) musicCommandMap.set(alias, cmd);
}
