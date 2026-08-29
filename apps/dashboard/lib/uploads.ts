import "server-only";
import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { uploadsDir } from "@ticketbot/db";
import type { EmbedConfig } from "@ticketbot/shared";
import { db, repos } from "./db";

const PREFIX_RE = /^\/u\/(\d+)\/([A-Za-z0-9._-]+)$/;
/** Don't delete files younger than this — they may be uploaded-but-not-yet-saved. */
const GRACE_MS = 10 * 60 * 1000;

function embedFiles(
  embed: EmbedConfig | null | undefined,
  guildId: string,
): string[] {
  if (!embed) return [];
  const out: string[] = [];
  for (const url of [embed.image, embed.thumbnail]) {
    const m = url?.match(PREFIX_RE);
    if (m && m[1] === guildId) out.push(m[2]!);
  }
  return out;
}

/** Every upload filename currently referenced by this guild's config. */
export function referencedUploads(guildId: string): Set<string> {
  const refs = new Set<string>();
  const cfg = repos.guildConfig.getGuildConfig(db(), guildId);
  for (const f of [
    ...embedFiles(cfg.welcomeEmbed, guildId),
    ...embedFiles(cfg.closeEmbed, guildId),
    ...embedFiles(cfg.feedbackPromptEmbed, guildId),
  ])
    refs.add(f);
  for (const cat of repos.categories.listCategories(db(), guildId)) {
    for (const f of embedFiles(cat.welcomeEmbed, guildId)) refs.add(f);
  }
  for (const panel of repos.panels.listPanels(db(), guildId)) {
    for (const f of embedFiles(panel.embed, guildId)) refs.add(f);
  }
  return refs;
}

/** Delete upload files no config points at (best-effort, fire-and-forget). */
export async function cleanupOrphanUploads(guildId: string): Promise<number> {
  const dir = uploadsDir(guildId);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return 0;
  }
  const referenced = referencedUploads(guildId);
  const cutoff = Date.now() - GRACE_MS;
  let removed = 0;
  for (const name of names) {
    if (referenced.has(name)) continue;
    const s = await stat(join(dir, name)).catch(() => null);
    if (!s?.isFile() || s.mtimeMs > cutoff) continue;
    await unlink(join(dir, name)).catch(() => {});
    removed++;
  }
  return removed;
}
