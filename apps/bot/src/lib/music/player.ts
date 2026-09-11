import { spawn } from "node:child_process";
import type { Readable } from "node:stream";
import ffmpegPath from "ffmpeg-static";
import { ytdlpExec } from "./ytdlp.js";
import {
  AudioPlayerStatus,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
} from "@discordjs/voice";
import { joinVoiceChannel } from "@discordjs/voice";
import type { GuildTextBasedChannel, VoiceBasedChannel } from "discord.js";
import { logger } from "../logger.js";
import { refreshNowPlaying } from "./nowPlaying.js";
import {
  GuildQueue,
  deleteQueue,
  getExistingQueue,
  getQueue,
  type LoopMode,
  type Track,
} from "./queue.js";

const IDLE_DISCONNECT_MS = 5 * 60_000;

function buildStream(url: string): {
  stream: Readable;
  yt: { kill(): unknown };
  ff: ReturnType<typeof spawn>;
} {
  const yt = ytdlpExec(url, {
    format: "bestaudio",
    output: "-",
    noPlaylist: true,
    quiet: true,
    noWarnings: true,
  });

  const ff = spawn(
    ffmpegPath as unknown as string,
    [
      "-loglevel",
      "error",
      "-i",
      "pipe:0",
      "-vn",
      "-f",
      "s16le",
      "-ar",
      "48000",
      "-ac",
      "2",
      "pipe:1",
    ],
    { stdio: ["pipe", "pipe", "ignore"] },
  );

  yt.stdout?.pipe(ff.stdin!);
  yt.catch((err: unknown) => {
    logger.error("yt-dlp stream failed", err);
    try {
      ff.kill();
    } catch {
      /* already dead */
    }
  });
  ff.on("error", (err) => logger.error("ffmpeg spawn error", err));

  return { stream: ff.stdout!, yt, ff };
}

async function ensureConnection(
  channel: VoiceBasedChannel,
): Promise<GuildQueue> {
  const queue = getQueue(channel.guild.id);

  if (
    !queue.connection ||
    queue.connection.state.status === VoiceConnectionStatus.Destroyed
  ) {
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      debug: true,
    });
    connection.on("debug", (msg) => logger.info(`[voice debug] ${msg}`));
    connection.on("error", (err) =>
      logger.error("voice connection error", err),
    );
    connection.on("stateChange", (oldState, newState) => {
      logger.info(`[voice state] ${oldState.status} -> ${newState.status}`);
      // TEMP DIAGNOSTIC: the actual WS close code is swallowed internally by
      // onNetworkingClose before it ever reaches our debug/error listeners —
      // hook the Networking instance's own "close" event directly to see it.
      const networking = (newState as { networking?: NodeJS.EventEmitter })
        .networking;
      if (networking && !(networking as { __hooked?: boolean }).__hooked) {
        (networking as { __hooked?: boolean }).__hooked = true;
        networking.once("close", (code: number) => {
          logger.info(`[voice ws close code] ${code}`);
        });
      }
      if (newState.status === VoiceConnectionStatus.Disconnected) {
        disconnect(channel.guild.id);
      }
    });
    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    } catch (err) {
      connection.destroy();
      throw err;
    }
    queue.connection = connection;
  }

  if (!queue.player) {
    const player = createAudioPlayer();
    player.on(AudioPlayerStatus.Idle, () => {
      void advance(channel.guild.id);
    });
    player.on("error", (err) => {
      logger.error("audio player error", err);
      void advance(channel.guild.id);
    });
    queue.connection.subscribe(player);
    queue.player = player;
  }

  return queue;
}

function scheduleIdleDisconnect(guildId: string): void {
  const queue = getExistingQueue(guildId);
  if (!queue) return;
  queue.clearIdleTimer();
  queue.idleTimer = setTimeout(() => disconnect(guildId), IDLE_DISCONNECT_MS);
  queue.idleTimer.unref();
}

async function playTrack(
  queue: GuildQueue,
  guildId: string,
  track: Track,
): Promise<void> {
  queue.killProcesses();
  const { stream, yt, ff } = buildStream(track.url);
  queue.ytProcess = yt;
  queue.ffmpegProcess = ff;

  const resource = createAudioResource(stream, {
    inputType: StreamType.Raw,
    inlineVolume: true,
  });
  resource.volume?.setVolume(queue.volume / 100);
  queue.resource = resource;
  queue.playingSince = Date.now();
  queue.current = track;
  queue.player?.play(resource);

  await refreshNowPlaying(queue, guildId, track).catch((err) =>
    logger.error("now playing post failed", err),
  );
}

async function playNext(guildId: string): Promise<void> {
  const queue = getExistingQueue(guildId);
  if (!queue) return;
  queue.clearIdleTimer();
  const next = queue.tracks.shift();
  if (!next) {
    queue.current = null;
    scheduleIdleDisconnect(guildId);
    return;
  }
  await playTrack(queue, guildId, next);
}

async function advance(guildId: string): Promise<void> {
  const queue = getExistingQueue(guildId);
  if (!queue) return;
  const forcedSkip = queue.skipRequested;
  queue.skipRequested = false;

  if (!forcedSkip && queue.loop === "track" && queue.current) {
    await playTrack(queue, guildId, queue.current);
    return;
  }
  if (queue.loop === "queue" && queue.current) {
    queue.tracks.push(queue.current);
  }
  await playNext(guildId);
}

/** Join (if needed), queue tracks, and start playback if the guild was idle. */
export async function enqueue(
  voiceChannel: VoiceBasedChannel,
  textChannel: GuildTextBasedChannel,
  tracks: Track[],
): Promise<{ startedImmediately: boolean }> {
  const queue = await ensureConnection(voiceChannel);
  queue.textChannel = textChannel;
  const wasIdle = !queue.current;
  queue.tracks.push(...tracks);
  if (wasIdle) {
    await playNext(voiceChannel.guild.id);
  }
  return { startedImmediately: wasIdle };
}

export function pause(guildId: string): void {
  const queue = getExistingQueue(guildId);
  queue?.player?.pause();
  if (queue?.current) void refreshNowPlaying(queue, guildId, queue.current);
}

export function resume(guildId: string): void {
  const queue = getExistingQueue(guildId);
  queue?.player?.unpause();
  if (queue?.current) void refreshNowPlaying(queue, guildId, queue.current);
}

export function skip(guildId: string): void {
  const queue = getExistingQueue(guildId);
  if (!queue) return;
  queue.skipRequested = true;
  queue.player?.stop(true);
}

export function stop(guildId: string): void {
  const queue = getExistingQueue(guildId);
  if (!queue) return;
  queue.tracks = [];
  queue.loop = "off";
  disconnect(guildId);
}

export function setVolume(guildId: string, pct: number): boolean {
  const queue = getExistingQueue(guildId);
  if (!queue) return false;
  queue.volume = pct;
  queue.resource?.volume?.setVolume(pct / 100);
  if (queue.current) void refreshNowPlaying(queue, guildId, queue.current);
  return true;
}

export function setLoop(guildId: string, mode: LoopMode): boolean {
  const queue = getExistingQueue(guildId);
  if (!queue) return false;
  queue.loop = mode;
  if (queue.current) void refreshNowPlaying(queue, guildId, queue.current);
  return true;
}

const LOOP_ORDER: LoopMode[] = ["off", "track", "queue"];

export function cycleLoop(guildId: string): LoopMode | null {
  const queue = getExistingQueue(guildId);
  if (!queue) return null;
  const nextMode =
    LOOP_ORDER[(LOOP_ORDER.indexOf(queue.loop) + 1) % LOOP_ORDER.length]!;
  queue.loop = nextMode;
  if (queue.current) void refreshNowPlaying(queue, guildId, queue.current);
  return nextMode;
}

export function shuffle(guildId: string): boolean {
  const queue = getExistingQueue(guildId);
  if (!queue) return false;
  for (let i = queue.tracks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = queue.tracks[i]!;
    const b = queue.tracks[j]!;
    queue.tracks[i] = b;
    queue.tracks[j] = a;
  }
  if (queue.current) void refreshNowPlaying(queue, guildId, queue.current);
  return true;
}

export function removeAt(guildId: string, position: number): Track | null {
  const queue = getExistingQueue(guildId);
  if (!queue) return null;
  const idx = position - 1;
  if (idx < 0 || idx >= queue.tracks.length) return null;
  const [removed] = queue.tracks.splice(idx, 1);
  if (queue.current) void refreshNowPlaying(queue, guildId, queue.current);
  return removed ?? null;
}

export function clearQueue(guildId: string): number {
  const queue = getExistingQueue(guildId);
  if (!queue) return 0;
  const n = queue.tracks.length;
  queue.tracks = [];
  if (queue.current) void refreshNowPlaying(queue, guildId, queue.current);
  return n;
}

export function disconnect(guildId: string): void {
  const queue = getExistingQueue(guildId);
  if (!queue) return;
  queue.clearIdleTimer();
  queue.killProcesses();
  try {
    queue.player?.stop(true);
  } catch {
    /* ignore */
  }
  try {
    queue.connection?.destroy();
  } catch {
    /* already destroyed */
  }
  deleteQueue(guildId);
}
