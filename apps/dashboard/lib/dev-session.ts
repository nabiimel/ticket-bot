/**
 * Operator / all-servers access, granted by Discord user id.
 *
 * Set `DEV_DISCORD_IDS` to a comma- or space-separated list of Discord user
 * ids. Those accounts, after signing in normally with Discord, get an `admin`
 * session on every server the bot is in. Unset = nobody, feature inert.
 *
 * This is a skeleton key to every tenant's data — only list ids you control.
 */
export function devDiscordIds(): Set<string> {
  return new Set(
    (process.env.DEV_DISCORD_IDS ?? "")
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function isDevDiscordId(id: string | null | undefined): boolean {
  if (!id) return false;
  return devDiscordIds().has(id);
}
