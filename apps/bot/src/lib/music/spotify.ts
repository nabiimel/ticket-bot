import { logger } from "../logger.js";

const TRACK_RE =
  /^https?:\/\/open\.spotify\.com\/(?:intl-\w+\/)?track\/[A-Za-z0-9]+/i;
const PLAYLIST_OR_ALBUM_RE =
  /^https?:\/\/open\.spotify\.com\/(?:intl-\w+\/)?(?:album|playlist)\/[A-Za-z0-9]+/i;

export function isSpotifyTrackUrl(text: string): boolean {
  return TRACK_RE.test(text.trim());
}

export function isSpotifyPlaylistOrAlbumUrl(text: string): boolean {
  return PLAYLIST_OR_ALBUM_RE.test(text.trim());
}

/**
 * Resolve a Spotify track URL to a "title artist" search string via Spotify's
 * public oEmbed endpoint — no API key/OAuth needed, but it only exposes a
 * single track's title/artist, not playlist or album contents.
 */
export async function resolveSpotifyTrackQuery(
  url: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(url.trim())}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: unknown;
      author_name?: unknown;
    };
    const title = typeof data.title === "string" ? data.title : null;
    if (!title) return null;
    const author =
      typeof data.author_name === "string" ? data.author_name : null;
    return author ? `${title} ${author}` : title;
  } catch (err) {
    logger.error("spotify oembed lookup failed", err);
    return null;
  }
}
