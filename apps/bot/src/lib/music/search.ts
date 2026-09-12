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

async function resolveTarget(
  target: string,
  flags: Record<string, unknown>,
): Promise<ResolvedTrack[]> {
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

const SEARCH_FLAGS = { noPlaylist: true };

/**
 * Resolve a `!play` argument — a bare search term or a track/playlist URL —
 * into track metadata. A direct URL (YouTube, SoundCloud, or anything
 * yt-dlp supports) is tried as given. A bare search term tries YouTube
 * first when a `cookies.txt` is present (see ytdlp.ts) — a real logged-in
 * session gets past YouTube's "Sign in to confirm you're not a bot" block
 * on anonymous cloud/VPS IPs — and falls back to SoundCloud if that yields
 * nothing, since YouTube's current SABR streaming rollout is separately (and
 * intermittently) breaking format extraction across multiple yt-dlp player
 * clients regardless of auth. SoundCloud has no bot-check but caps
 * label-owned tracks to a 30s preview for non-subscribers. The actual
 * streamable URL is resolved lazily per track at playback time (see
 * player.ts), since flat-playlist entries here don't carry a playable format.
 */
export async function resolveQuery(query: string): Promise<ResolvedTrack[]> {
  const trimmed = query.trim();
  if (URL_RE.test(trimmed)) {
    return resolveTarget(trimmed, { flatPlaylist: true, playlistEnd: 50 });
  }

  if (hasYouTubeCookies()) {
    const fromYouTube = await resolveTarget(
      `ytsearch1:${trimmed}`,
      SEARCH_FLAGS,
    );
    if (fromYouTube.length > 0) return fromYouTube;
    logger.warn("YouTube search returned nothing — falling back to SoundCloud");
  }
  return resolveTarget(`scsearch1:${trimmed}`, SEARCH_FLAGS);
}
