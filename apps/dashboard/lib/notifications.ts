import "server-only";
import type { FeedNotification } from "@ticketbot/shared";
import { db, repos } from "./db";
import { fmtDuration } from "./format";

/**
 * The notification centre is derived on every read — there is no bot-side
 * dispatcher and nothing is posted to Discord. It aggregates things that
 * already live in the database (stale open tickets, low ratings, failed jobs,
 * config changes by teammates) into one time-ordered feed, and compares it
 * against a per-user "seen up to here" marker for the unread badge.
 */

export const LOW_RATING_AT_OR_BELOW = 2;

export interface NotificationFeed {
  items: FeedNotification[];
  lastSeen: number;
  /** Attention-worthy (non-info) items newer than `lastSeen`. */
  unread: number;
}

export function getNotificationFeed(
  guildId: string,
  userId: string,
  limit = 40,
): NotificationFeed {
  const d = db();
  const cfg = repos.guildConfig.getGuildConfig(d, guildId);
  const cats = repos.categories.listCategories(d, guildId);
  const catLabel = (id: number | null) =>
    (id != null && cats.find((c) => c.id === id)?.label) || "Uncategorized";
  const nowS = Math.floor(Date.now() / 1000);
  const age = (from: number) => fmtDuration(nowS - from);
  const slaUnclaimedS = cfg.slaUnclaimedMins * 60;
  const slaNoReplyS = cfg.slaNoReplyMins * 60;

  const items: FeedNotification[] = [];

  // --- SLA: still-open tickets past a threshold ---
  for (const t of repos.tickets.listOpenTickets(d, guildId)) {
    if (cfg.claimingEnabled && !t.claimedBy) {
      const at = t.createdAt + slaUnclaimedS;
      if (at <= nowS) {
        items.push({
          key: `sla_unclaimed:${t.id}`,
          type: "sla_unclaimed",
          severity: "critical",
          title: `Ticket #${t.number} is still unclaimed`,
          body: `Open ${age(t.createdAt)} · ${catLabel(t.categoryId)}`,
          at,
          href: `/dashboard/${guildId}/tickets`,
        });
      }
    }
    if (!t.firstStaffMsgAt) {
      const at = t.createdAt + slaNoReplyS;
      if (at <= nowS) {
        items.push({
          key: `sla_no_reply:${t.id}`,
          type: "sla_no_reply",
          severity: "warn",
          title: `Ticket #${t.number} has no staff reply yet`,
          body: `Open ${age(t.createdAt)} · ${catLabel(t.categoryId)}`,
          at,
          href: `/dashboard/${guildId}/tickets`,
        });
      }
    }
  }

  // --- Low ratings ---
  for (const r of repos.ratings.listLowRatings(
    d,
    guildId,
    LOW_RATING_AT_OR_BELOW,
    15,
  )) {
    const num = repos.tickets.getTicket(d, r.ticketId)?.number ?? r.ticketId;
    items.push({
      key: `low_rating:${r.ticketId}`,
      type: "low_rating",
      severity: r.score <= 1 ? "critical" : "warn",
      title: `${r.score}★ rating on ticket #${num}`,
      body: r.comment ? `“${r.comment.slice(0, 140)}”` : undefined,
      at: r.createdAt,
      href: `/dashboard/${guildId}/stats`,
    });
  }

  // --- Failed background jobs ---
  for (const j of repos.jobs.listJobs(d, guildId, 30)) {
    if (j.status !== "error") continue;
    items.push({
      key: `job_failed:${j.id}`,
      type: "job_failed",
      severity: "warn",
      title: `A background task failed (${j.type})`,
      body: j.error ? j.error.slice(0, 160) : undefined,
      at: j.processedAt ?? j.createdAt,
    });
  }

  // --- Config changes made by other admins ---
  for (const a of repos.audit.listAudit(d, guildId, 20)) {
    if (a.actorId === userId) continue; // not my own edits
    items.push({
      key: `config_changed:${a.id}`,
      type: "config_changed",
      severity: "info",
      title: a.summary,
      at: a.createdAt,
      href: `/dashboard/${guildId}/audit`,
    });
  }

  // --- Light activity: recent opens / closes ---
  for (const t of repos.tickets.listRecentlyOpened(d, guildId, 10)) {
    items.push({
      key: `ticket_opened:${t.id}`,
      type: "ticket_opened",
      severity: "info",
      title: `Ticket #${t.number} opened`,
      body: catLabel(t.categoryId),
      at: t.createdAt,
      href: `/dashboard/${guildId}/tickets`,
    });
  }
  for (const t of repos.tickets.listClosedTickets(d, guildId, 10)) {
    items.push({
      key: `ticket_closed:${t.id}`,
      type: "ticket_closed",
      severity: "info",
      title: `Ticket #${t.number} closed`,
      body: t.closeReason ?? undefined,
      at: t.closedAt ?? t.createdAt,
      href: `/dashboard/${guildId}/transcripts/${t.id}`,
    });
  }

  // De-dupe by key (a ticket can't be in the feed twice for the same reason),
  // newest first.
  const seen = new Set<string>();
  const deduped = items
    .sort((a, b) => b.at - a.at)
    .filter((i) => (seen.has(i.key) ? false : (seen.add(i.key), true)));

  const lastSeen = repos.notifications.getLastSeen(d, guildId, userId);
  const unread = deduped.filter(
    (i) => i.severity !== "info" && i.at > lastSeen,
  ).length;

  return { items: deduped.slice(0, limit), lastSeen, unread };
}
