import type { Message } from "discord.js";

/** Optional override; not surfaced anywhere in the dashboard. */
export const PREFIX = process.env.MUSIC_PREFIX?.trim() || "!";

export interface PrefixCommand {
  name: string;
  aliases?: string[];
  description: string;
  execute(message: Message<true>, args: string[]): Promise<void>;
}
