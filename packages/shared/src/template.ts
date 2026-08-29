import type { EmbedConfig } from "./types.js";
import type { TemplateContext } from "./placeholders.js";

const TOKEN_RE = /\{([a-zA-Z0-9_.]+)\}/g;

/**
 * Replace {placeholder} tokens in a string using the provided context.
 * Unknown tokens are left untouched so authors can see what they typed.
 */
export function renderTemplate(
  input: string | undefined | null,
  ctx: TemplateContext,
): string | undefined {
  if (input == null || input === "") return input ?? undefined;
  return input.replace(TOKEN_RE, (whole, key: string) => {
    const value = ctx[key];
    return value === undefined ? whole : String(value);
  });
}

/** Apply `renderTemplate` to every user-facing string field of an EmbedConfig. */
export function renderEmbedConfig(
  embed: EmbedConfig,
  ctx: TemplateContext,
): EmbedConfig {
  return {
    ...embed,
    title: renderTemplate(embed.title, ctx),
    description: renderTemplate(embed.description, ctx),
    image: renderTemplate(embed.image, ctx),
    thumbnail: renderTemplate(embed.thumbnail, ctx),
    footer: embed.footer
      ? {
          text: renderTemplate(embed.footer.text, ctx) ?? "",
          iconUrl: renderTemplate(embed.footer.iconUrl, ctx),
        }
      : undefined,
    author: embed.author
      ? {
          name: renderTemplate(embed.author.name, ctx) ?? "",
          iconUrl: renderTemplate(embed.author.iconUrl, ctx),
          url: embed.author.url,
        }
      : undefined,
  };
}

/** Parse "#5865F2" (or "5865F2") into an integer for discord.js. Falls back to blurple. */
export function hexToInt(hex: string | undefined, fallback = 0x5865f2): number {
  if (!hex) return fallback;
  const cleaned = hex.replace(/^#/, "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return fallback;
  return parseInt(cleaned, 16);
}
