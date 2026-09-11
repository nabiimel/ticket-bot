import type { Message } from "discord.js";

/** Resolves the invoking member, fetching if not already cached. */
export async function resolveMember(message: Message<true>) {
  return (
    message.member ??
    (await message.guild.members.fetch(message.author.id).catch(() => null))
  );
}

/**
 * Guard for playback-control commands: the invoker must be in the same voice
 * channel as the bot. Replies and returns false otherwise.
 */
export async function requireSameVoiceAsBot(
  message: Message<true>,
): Promise<boolean> {
  const botChannelId = message.guild.members.me?.voice.channelId;
  if (!botChannelId) {
    await message.reply("I'm not in a voice channel.");
    return false;
  }
  const member = await resolveMember(message);
  if (member?.voice.channelId !== botChannelId) {
    await message.reply(
      "Join the same voice channel as me to control playback.",
    );
    return false;
  }
  return true;
}
