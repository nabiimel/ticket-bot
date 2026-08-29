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
const TTL = 60_000;

async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await fetcher();
  cache.set(key, { value, at: Date.now() });
  return value;
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

/** Guilds the user is in where they can Manage Server (or own). */
export async function getManageableGuilds(
  accessToken: string,
): Promise<UserGuild[]> {
  const guilds = await cached(
    `userguilds:${tokenKey(accessToken)}`,
    async () => {
      const res = await fetch(`${API}/users/@me/guilds`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (!res.ok) return [] as UserGuild[];
      return (await res.json()) as UserGuild[];
    },
  );
  return guilds.filter(
    (g) => g.owner || (BigInt(g.permissions) & BigInt(MANAGE_GUILD)) !== 0n,
  );
}

export async function userCanManageGuild(
  accessToken: string,
  guildId: string,
): Promise<boolean> {
  const guilds = await getManageableGuilds(accessToken);
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

export function textChannels(channels: DiscordChannel[]) {
  return channels.filter((c) => c.type === 0);
}
export function categoryChannels(channels: DiscordChannel[]) {
  return channels.filter((c) => c.type === 4);
}
