import type { CategoryConfig, GuildConfig } from "@ticketbot/shared";
import { repos } from "@ticketbot/db";
import { getDb } from "./db.js";

/**
 * Short-lived cache so a burst of interactions doesn't hit SQLite for every
 * config read. The jobs worker calls `bustConfigCache()` after processing so
 * dashboard edits show up within one poll cycle.
 */
const TTL_MS = 10_000;

interface Entry<T> {
  value: T;
  at: number;
}

const guildConfigCache = new Map<string, Entry<GuildConfig>>();
const categoriesCache = new Map<string, Entry<CategoryConfig[]>>();

export function getGuildConfigCached(guildId: string): GuildConfig {
  const hit = guildConfigCache.get(guildId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = repos.guildConfig.ensureGuildConfig(getDb(), guildId);
  guildConfigCache.set(guildId, { value, at: Date.now() });
  return value;
}

export function getCategoriesCached(guildId: string): CategoryConfig[] {
  const hit = categoriesCache.get(guildId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = repos.categories.listCategories(getDb(), guildId);
  categoriesCache.set(guildId, { value, at: Date.now() });
  return value;
}

export function bustConfigCache(guildId?: string): void {
  if (guildId) {
    guildConfigCache.delete(guildId);
    categoriesCache.delete(guildId);
  } else {
    guildConfigCache.clear();
    categoriesCache.clear();
  }
}
