import "server-only";
import { createHash } from "node:crypto";

const API = "https://discord.com/api/v10";
const MANAGE_GUILD = 0x20;

/** Short, non-reversible cache key for a bearer token. */
function tokenKey(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 32);
}

interface CacheEntry<T> {
  value: T;
  at: number;
}
const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const TTL = 60_000;

async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await fetcher();
  cache.set(key, { value, at: Date.now() });
  return value;
}

/**
 * Like `cached`, but:
 *  - a fetcher that throws never poisons the cache;
 *  - on failure the last good value is served (any age) instead of throwing;
 *  - concurrent callers for the same key share one in-flight request.
 * Used for the OAuth guild list, which gates access and must not flap to "empty"
 * on a transient Discord 429.
 */
async function resilient<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && Date.now() - hit.at < ttl) return hit.value;

  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;

  const p = (async () => {
    try {
      const value = await fetcher();
      cache.set(key, { value, at: Date.now() });
      return value;
    } catch (err) {
      if (hit) return hit.value; // serve stale rather than lock the user out
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

export function bustDiscordCache(prefix?: string): void {
  if (!prefix) return cache.clear();
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
}

// ---------------------------------------------------------------------------
// User-token calls (OAuth)
// ---------------------------------------------------------------------------

export interface UserGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

const GUILDS_TTL = 5 * 60_000;

async function fetchManageableGuilds(
  accessToken: string,
): Promise<UserGuild[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (res.ok) {
      const all = (await res.json()) as UserGuild[];
      return all.filter(
        (g) => g.owner || (BigInt(g.permissions) & BigInt(MANAGE_GUILD)) !== 0n,
      );
    }
    // One retry on rate-limit, honouring Retry-After (capped).
    if (res.status === 429 && attempt === 0) {
      const wait = Number(res.headers.get("retry-after") ?? "1") * 1000;
      await new Promise((r) => setTimeout(r, Math.min(wait || 1000, 5000)));
      continue;
    }
    throw new Error(`discord /users/@me/guilds -> ${res.status}`);
  }
  throw new Error("discord /users/@me/guilds -> retries exhausted");
}

/**
 * Guilds the user can Manage Server (or owns). `userKey` (the Discord user id)
 * keeps the cache stable across access-token rotation; falls back to a token
 * hash. Throws only when there is no fresh *and* no stale value to serve.
 */
export async function getManageableGuilds(
  accessToken: string,
  userKey?: string,
): Promise<UserGuild[]> {
  return resilient(
    `userguilds:${userKey ?? tokenKey(accessToken)}`,
    GUILDS_TTL,
    () => fetchManageableGuilds(accessToken),
  );
}

export async function userCanManageGuild(
  accessToken: string,
  guildId: string,
  userKey?: string,
): Promise<boolean> {
  const guilds = await getManageableGuilds(accessToken, userKey);
  return guilds.some((g) => g.id === guildId);
}

// ---------------------------------------------------------------------------
// Bot-token calls (REST)
// ---------------------------------------------------------------------------

function botHeaders() {
  return { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` };
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number; // 0 text, 4 category
  position: number;
  parent_id: string | null;
}

export async function getGuildRoles(guildId: string): Promise<DiscordRole[]> {
  return cached(`roles:${guildId}`, async () => {
    const res = await fetch(`${API}/guilds/${guildId}/roles`, {
      headers: botHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const roles = (await res.json()) as DiscordRole[];
    return roles
      .filter((r) => r.name !== "@everyone")
      .sort((a, b) => b.position - a.position);
  });
}

export async function getGuildChannels(
  guildId: string,
): Promise<DiscordChannel[]> {
  return cached(`channels:${guildId}`, async () => {
    const res = await fetch(`${API}/guilds/${guildId}/channels`, {
      headers: botHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return [];
    return ((await res.json()) as DiscordChannel[]).sort(
      (a, b) => a.position - b.position,
    );
  });
}

/**
 * `userId -> display name` for up to 1000 guild members (needs the Server
 * Members intent, which the bot has). Empty map if the request fails.
 */
export async function getGuildMemberNames(
  guildId: string,
): Promise<Map<string, string>> {
  return cached(`members:${guildId}`, async () => {
    const map = new Map<string, string>();
    const res = await fetch(`${API}/guilds/${guildId}/members?limit=1000`, {
      headers: botHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return map;
    const rows = (await res.json()) as {
      user?: { id: string; username: string; global_name?: string | null };
      nick?: string | null;
    }[];
    for (const m of rows) {
      if (!m.user) continue;
      map.set(m.user.id, m.nick || m.user.global_name || m.user.username);
    }
    return map;
  });
}

/** Display name for an id, falling back to the raw id. */
export function nameOf(
  names: Map<string, string>,
  id: string | null | undefined,
): string {
  if (!id) return "—";
  return names.get(id) ?? id;
}

export function textChannels(channels: DiscordChannel[]) {
  return channels.filter((c) => c.type === 0);
}
export function categoryChannels(channels: DiscordChannel[]) {
  return channels.filter((c) => c.type === 4);
}
