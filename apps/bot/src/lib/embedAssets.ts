import { existsSync } from "node:fs";
import { join } from "node:path";
import { AttachmentBuilder, type EmbedBuilder } from "discord.js";
import type { EmbedConfig, TemplateContext } from "@ticketbot/shared";
import { uploadsDir } from "@ticketbot/db";
import { buildEmbed } from "./embeds.js";

/** Dashboard-uploaded images are stored as `/u/<guildId>/<file>` URLs. */
export const UPLOAD_PREFIX = "/u/";

function sanitize(part: string): string {
  return part.replace(/[^A-Za-z0-9._-]/g, "");
}

/**
 * Parse a `/u/<guildId>/<file>` dashboard-upload URL into its sanitized parts.
 * Returns null for anything that isn't a well-formed upload path. Pure (no fs).
 */
export function parseUploadUrl(
  url: string | undefined | null,
): { guildId: string; file: string } | null {
  if (!url || !url.startsWith(UPLOAD_PREFIX)) return null;
  const parts = url.slice(UPLOAD_PREFIX.length).split("/");
  if (parts.length !== 2) return null;
  const guildId = sanitize(parts[0]!);
  const file = sanitize(parts[1]!);
  if (!guildId || !file || !/^\d+$/.test(guildId) || !/\./.test(file)) {
    return null;
  }
  return { guildId, file };
}

/**
 * If `url` is a dashboard upload path whose file exists on disk, return the
 * disk path + a safe attachment name; otherwise null.
 */
function localUpload(
  url: string | undefined,
): { disk: string; name: string } | null {
  const parsed = parseUploadUrl(url);
  if (!parsed) return null;
  const disk = join(uploadsDir(parsed.guildId), parsed.file);
  return existsSync(disk) ? { disk, name: parsed.file } : null;
}

/**
 * Turn a list of `/u/<guildId>/<file>` dashboard-upload URLs into Discord
 * attachments, skipping any whose file is missing on disk. Used to send snippet
 * images. De-dupes by filename.
 */
export function resolveUploadFiles(urls: string[]): AttachmentBuilder[] {
  const files: AttachmentBuilder[] = [];
  for (const url of urls) {
    const up = localUpload(url);
    if (up && !files.some((f) => f.name === up.name)) {
      files.push(new AttachmentBuilder(up.disk, { name: up.name }));
    }
  }
  return files;
}

export interface EmbedWithAssets {
  embed: EmbedBuilder;
  /** Attachments that must be included in the same `send`/`edit` call. */
  files: AttachmentBuilder[];
}

/**
 * Like `buildEmbed`, but rewrites `image` / `thumbnail` that point at a
 * dashboard upload to `attachment://…` and returns the files to attach. This
 * makes uploaded images render in Discord even when the dashboard isn't
 * publicly reachable. Upload paths whose file is missing are dropped.
 */
export function buildEmbedWithAssets(
  cfg: EmbedConfig,
  ctx: TemplateContext,
): EmbedWithAssets {
  const files: AttachmentBuilder[] = [];
  const next: EmbedConfig = { ...cfg };

  for (const key of ["image", "thumbnail"] as const) {
    const value = next[key];
    const up = localUpload(value);
    if (up) {
      if (!files.some((f) => f.name === up.name)) {
        files.push(new AttachmentBuilder(up.disk, { name: up.name }));
      }
      next[key] = `attachment://${up.name}`;
    } else if (value?.startsWith(UPLOAD_PREFIX)) {
      // upload path but the file is gone — drop it so the builder doesn't throw
      next[key] = undefined;
    }
  }

  return { embed: buildEmbed(next, ctx), files };
}
