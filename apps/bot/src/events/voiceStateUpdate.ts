import { Events, type VoiceState } from "discord.js";
import { getExistingQueue } from "../lib/music/queue.js";
import { disconnect } from "../lib/music/player.js";

export const name = Events.VoiceStateUpdate;

/** Auto-leave if everyone else leaves the bot's voice channel. */
export function execute(oldState: VoiceState, newState: VoiceState): void {
  const guild = newState.guild ?? oldState.guild;
  const queue = getExistingQueue(guild.id);
  if (!queue?.connection) return;

  const botChannelId = guild.members.me?.voice.channelId;
  if (!botChannelId) return;

  const relevant =
    oldState.channelId === botChannelId || newState.channelId === botChannelId;
  if (!relevant) return;

  const channel = guild.channels.cache.get(botChannelId);
  if (!channel || !channel.isVoiceBased()) return;

  const humans = channel.members.filter((m) => !m.user.bot).size;
  if (humans === 0) disconnect(guild.id);
}
