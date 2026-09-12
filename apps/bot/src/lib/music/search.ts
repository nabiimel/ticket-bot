import { cookiesFlags, hasYouTubeCookies, ytdlpExec } from "./ytdlp.js";
import { logger } from "../logger.js";

export interface ResolvedTrack {
  title: string;
  url: string;
  durationSec: number | null;
  thumbnail: string | null;
}

const URL_RE = /^https?:\/\//i;

function toTrack(entry: Record<string, unknown>): ResolvedTrack | null {
  const webpageUrl =
    typeof entry.webpage_url === "string" ? entry.webpage_url : null;
  const rawUrl = typeof entry.url === "string" ? entry.url : null;
  const url = webpageUrl ?? (rawUrl && URL_RE.test(rawUrl) ? rawUrl : null);
  if (!url) return null;

  const title =
    (typeof entry.title === "string" && entry.title) ||
    (typeof entry.fulltitle === "string" && entry.fulltitle) ||
    url;
  const durationSec =
    typeof entry.duration === "number" ? entry.duration : null;
  const thumbnails = Array.isArray(entry.thumbnails) ? entry.thumbnails : [];
  const lastThumb = thumbnails.at(-1) as { url?: unknown } | undefined;
  const thumbnail =
    (typeof entry.thumbnail === "string" && entry.thumbnail) ||
    (typeof lastThumb?.url === "string" && lastThumb.url) ||
    null;

  return { title, url, durationSec, thumbnail };
}

async function dumpJsonLines(
  target: string,
  flags: Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  const { stdout } = await ytdlpExec(target, {
    dumpJson: true,
    noWarnings: true,
    quiet: true,
    ...cookiesFlags(),
    ...flags,
  });
  const results: Record<string, unknown>[] = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      results.push(JSON.parse(trimmed) as Record<string, unknown>);
    } catch {
      // skip malformed line
    }
  }
  return results;
}

/**
 * Resolve a `!play` argument — a bare search term or a track/playlist URL —
 * into track metadata. Bare search terms go to YouTube (`ytsearch1:`) when a
 * `cookies.txt` is present (see ytdlp.ts) — a real logged-in session gets
 * past YouTube's "Sign in to confirm you're not a bot" block on anonymous
 * cloud/VPS IPs, which no client-spoofing flag gets around. Without cookies,
 * search falls back to SoundCloud, which has no such check but caps
 * label-owned tracks to a 30s preview for anyone not logged into SoundCloud
 * itself. A direct URL (YouTube, SoundCloud, or anything yt-dlp supports)
 * still works as given either way. The actual streamable URL is resolved
 * lazily per track at playback time (see player.ts), since flat-playlist
 * entries here don't carry a playable format.
 */
export async function resolveQuery(query: string): Promise<ResolvedTrack[]> {
  const trimmed = query.trim();
  const isUrl = URL_RE.test(trimmed);
  const searchPrefix = hasYouTubeCookies() ? "ytsearch1:" : "scsearch1:";
  const target = isUrl ? trimmed : `${searchPrefix}${trimmed}`;
  const flags = isUrl
    ? { flatPlaylist: true, playlistEnd: 50 }
    : { noPlaylist: true };

  try {
    const entries = await dumpJsonLines(target, flags);
    const tracks: ResolvedTrack[] = [];
    for (const entry of entries) {
      const track = toTrack(entry);
      if (track) tracks.push(track);
    }
    return tracks;
  } catch (err) {
    logger.error("yt-dlp resolve failed", err);
    return [];
  }
}
