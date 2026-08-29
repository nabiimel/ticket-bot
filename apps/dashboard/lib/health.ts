import "server-only";
import { db, repos } from "./db";
import { getGuildChannels, getGuildRoles } from "./discord";

export type HealthIssue = {
  level: "error" | "warn";
  message: string;
  href: string;
};

/**
 * Cross-checks the stored config against the live guild (roles / channels) and
 * against itself, surfacing references that will silently break the bot.
 */
export async function guildHealth(guildId: string): Promise<HealthIssue[]> {
  const cfg = repos.guildConfig.getGuildConfig(db(), guildId);
  const cats = repos.categories.listCategories(db(), guildId);
  const panels = repos.panels.listPanels(db(), guildId);

  let roleIds = new Set<string>();
  let channelIds = new Set<string>();
  try {
    const [roles, channels] = await Promise.all([
      getGuildRoles(guildId),
      getGuildChannels(guildId),
    ]);
    roleIds = new Set(roles.map((r) => r.id));
    channelIds = new Set(channels.map((c) => c.id));
  } catch {
    // Discord unreachable — keep the structural checks, skip the ref checks.
  }
  const knowRoles = roleIds.size > 0;
  const knowChannels = channelIds.size > 0;

  const issues: HealthIssue[] = [];
  const at = (p: string) => `/dashboard/${guildId}${p}`;

  for (const c of cats) {
    if (c.staffRoleIds.length === 0 && !cfg.defaultStaffRoleId) {
      issues.push({
        level: "error",
        message: `Category “${c.label}” has no staff role — nobody can see its tickets.`,
        href: at(`/categories/${c.id}`),
      });
    }
    if (knowRoles) {
      const dead = c.staffRoleIds.filter((id) => !roleIds.has(id)).length;
      if (dead > 0) {
        issues.push({
          level: "warn",
          message: `Category “${c.label}” references ${dead} deleted staff role${dead === 1 ? "" : "s"}.`,
          href: at(`/categories/${c.id}`),
        });
      }
    }
  }

  for (const p of panels) {
    const label = p.embed.title ? `“${p.embed.title}”` : `#${p.id}`;
    if (p.status === "published" && !p.channelId) {
      issues.push({
        level: "error",
        message: `Panel ${label} is published but has no target channel.`,
        href: at(`/panels/${p.id}`),
      });
    }
    if (
      p.status === "published" &&
      p.channelId &&
      knowChannels &&
      !channelIds.has(p.channelId)
    ) {
      issues.push({
        level: "error",
        message: `Panel ${label} points at a channel that no longer exists.`,
        href: at(`/panels/${p.id}`),
      });
    }
    if (p.categoryIds.length === 0) {
      issues.push({
        level: "warn",
        message: `Panel ${label} has no categories — its buttons do nothing.`,
        href: at(`/panels/${p.id}`),
      });
    }
  }

  if (knowChannels) {
    if (cfg.logChannelId && !channelIds.has(cfg.logChannelId)) {
      issues.push({
        level: "warn",
        message: "The configured log channel no longer exists.",
        href: at("/general"),
      });
    }
    if (cfg.transcriptChannelId && !channelIds.has(cfg.transcriptChannelId)) {
      issues.push({
        level: "warn",
        message: "The configured transcript channel no longer exists.",
        href: at("/general"),
      });
    }
    if (
      cfg.closeBehaviour === "archive" &&
      cfg.archiveCategoryId &&
      !channelIds.has(cfg.archiveCategoryId)
    ) {
      issues.push({
        level: "warn",
        message:
          "The archive category no longer exists — closed tickets can't be archived.",
        href: at("/general"),
      });
    }
  }

  return issues;
}
