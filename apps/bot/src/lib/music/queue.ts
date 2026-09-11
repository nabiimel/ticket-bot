import type {
  AudioPlayer,
  AudioResource,
  VoiceConnection,
} from "@discordjs/voice";
import type { ChildProcess } from "node:child_process";
import type { GuildTextBasedChannel, Message } from "discord.js";
import type { ResolvedTrack } from "./search.js";

export type LoopMode = "off" | "track" | "queue";

export interface Track extends ResolvedTrack {
  requestedByName: string;
}

/** Per-guild live playback state. In-memory only — resets on bot restart. */
export class GuildQueue {
  tracks: Track[] = [];
  current: Track | null = null;
  loop: LoopMode = "off";
  volume = 100;
  /** Set by skip() so a loop:"track" cycle doesn't just replay the same track. */
  skipRequested = false;

  connection: VoiceConnection | null = null;
  player: AudioPlayer | null = null;
  resource: AudioResource | null = null;

  textChannel: GuildTextBasedChannel | null = null;
  nowPlayingMessage: Message | null = null;

  /** Wall-clock ms elapsed in the current track before the most recent resume/start. */
  elapsedMsBase = 0;
  /** Wall-clock timestamp of the most recent resume/start, or null while paused. */
  resumedAt: number | null = null;
  idleTimer: NodeJS.Timeout | null = null;
  /** Ticks the Now Playing embed's progress bar while a track is actively playing. */
  progressTimer: NodeJS.Timeout | null = null;

  ytProcess: { kill(): unknown } | null = null;
  ffmpegProcess: ChildProcess | null = null;

  clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  clearProgressTimer(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  /** Kill any in-flight yt-dlp/ffmpeg pipeline for the current track. */
  killProcesses(): void {
    try {
      this.ytProcess?.kill();
    } catch {
      /* already dead */
    }
    try {
      this.ffmpegProcess?.kill("SIGKILL");
    } catch {
      /* already dead */
    }
    this.ytProcess = null;
    this.ffmpegProcess = null;
  }
}

const queues = new Map<string, GuildQueue>();

export function getQueue(guildId: string): GuildQueue {
  let queue = queues.get(guildId);
  if (!queue) {
    queue = new GuildQueue();
    queues.set(guildId, queue);
  }
  return queue;
}

export function getExistingQueue(guildId: string): GuildQueue | undefined {
  return queues.get(guildId);
}

export function deleteQueue(guildId: string): void {
  queues.get(guildId)?.killProcesses();
  queues.delete(guildId);
}

/** Ms elapsed in the current track, correctly excluding any paused time. */
export function getElapsedMs(queue: GuildQueue): number {
  const running = queue.resumedAt != null ? Date.now() - queue.resumedAt : 0;
  return queue.elapsedMsBase + running;
}
