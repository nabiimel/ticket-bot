import Link from "next/link";
import { db, repos } from "@/lib/db";
import { guildHealth } from "@/lib/health";
import { fmtAgo, fmtDuration } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { OpenTicketRow } from "@/components/OpenTicketRow";
import { Relative } from "@/components/Relative";

export const dynamic = "force-dynamic";

export default async function Overview({
  params,
}: {
  params: { guildId: string };
}) {
  const { guildId } = params;
  const cfg = repos.guildConfig.getGuildConfig(db(), guildId);
  const stats = repos.stats.getGuildStats(db(), guildId, 30);
  const categories = repos.categories.listCategories(db(), guildId);
  const panels = repos.panels.listPanels(db(), guildId);
  const openTickets = repos.tickets.listOpenTickets(db(), guildId);
  const recentOpened = repos.tickets.listRecentlyOpened(db(), guildId, 15);
  const recentClosed = repos.tickets.listClosedTickets(db(), guildId, 15);
  const audit = repos.audit.listAudit(db(), guildId, 15);
  const issues = await guildHealth(guildId);

  const catLabel = (id: number | null) =>
    (id != null && categories.find((c) => c.id === id)?.label) ||
    "Uncategorized";

  const setup: string[] = [];
  if (!cfg.logChannelId) setup.push("Set a log channel in General");
  if (!cfg.transcriptChannelId)
    setup.push("Set a transcript channel in General");
  if (categories.length === 0) setup.push("Create a ticket category");
  if (panels.filter((p) => p.status === "published").length === 0)
    setup.push("Publish a panel");

  const claiming = cfg.claimingEnabled;
  const serverNow = Date.now() / 1000;
  const openList = [...openTickets]
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, 8);
  const unclaimedCount = claiming
    ? openTickets.filter((t) => !t.claimedBy).length
    : 0;

  const maxCat = Math.max(1, ...stats.byCategory.map((c) => c.count));

  type FeedItem = { at: number; kind: string; text: string; href?: string };
  const feed: FeedItem[] = [
    ...audit.map((a) => ({
      at: a.createdAt,
      kind: "config",
      text: a.summary,
      href: `/dashboard/${guildId}/audit`,
    })),
    ...recentClosed.map((t) => ({
      at: t.closedAt ?? t.createdAt,
      kind: "close",
      text: `Ticket #${t.number} closed${t.closeReason ? ` — ${t.closeReason}` : ""}`,
      href: `/dashboard/${guildId}/transcripts/${t.id}`,
    })),
    ...recentOpened.map((t) => ({
      at: t.createdAt,
      kind: "open",
      text: `Ticket #${t.number} opened (${catLabel(t.categoryId)})`,
    })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 12);

  const dot: Record<string, string> = {
    config: "bg-accent",
    close: "bg-[var(--danger)]",
    open: "bg-[var(--success)]",
  };

  return (
    <div className="page">
      <PageHeader
        title="Overview"
        description="A snapshot of this server's ticket system."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="stat">
          <div className="stat-value">{openTickets.length}</div>
          <div className="stat-label">Open now</div>
        </div>
        <div className="stat">
          <div className="stat-value">
            {stats.avgRating != null ? `${stats.avgRating.toFixed(1)} ★` : "—"}
          </div>
          <div className="stat-label">
            Avg rating{" "}
            {stats.ratingCount > 0 && (
              <span className="text-faint">({stats.ratingCount})</span>
            )}
          </div>
        </div>
        <div className="stat">
          <div className="stat-value">
            {fmtDuration(stats.avgSecondsToFirstReply)}
          </div>
          <div className="stat-label">Avg first response</div>
        </div>
        <div className="stat">
          <div className="stat-value">
            {fmtDuration(stats.avgSecondsToClose)}
          </div>
          <div className="stat-label">Avg time to close</div>
        </div>
      </div>
      <p className="-mt-2 text-xs text-faint">
        {stats.totalCount} opened · {stats.closedCount} closed in the last 30
        days.
      </p>

      {issues.length > 0 ? (
        <div className="note note-danger">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--danger-border)] text-xs">
              !
            </span>
            Needs attention
            <span className="text-xs font-normal opacity-70">
              {issues.filter((i) => i.level === "error").length} error(s) ·{" "}
              {issues.filter((i) => i.level === "warn").length} warning(s)
            </span>
          </h2>
          <ul className="space-y-1.5 text-sm">
            {issues.map((i, n) => (
              <li key={n} className="flex items-start gap-2">
                <span className="mt-0.5">
                  {i.level === "error" ? "✕" : "▲"}
                </span>
                <Link
                  href={i.href}
                  className="underline-offset-2 hover:underline"
                >
                  {i.message}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="note note-success text-sm">
          ✓ No configuration problems found.
        </div>
      )}

      {setup.length > 0 && (
        <div className="note note-warn">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--warn-border)] text-xs">
              !
            </span>
            Finish setting up
          </h2>
          <ul className="ml-7 list-disc space-y-1 text-sm opacity-90">
            {setup.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Open tickets</h2>
          <span className="text-xs text-faint">
            {openTickets.length} total
            {unclaimedCount > 0 && ` · ${unclaimedCount} unclaimed`}
          </span>
        </div>
        {openList.length === 0 ? (
          <p className="text-sm text-faint">No open tickets. 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-faint">
                <tr>
                  <th className="pb-2 pr-3 font-medium">Ticket</th>
                  <th className="pb-2 pr-3 font-medium">Type</th>
                  <th className="pb-2 pr-3 font-medium">Status</th>
                  <th className="pb-2 pr-3 text-right font-medium">Age</th>
                  <th className="pb-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {openList.map((t) => (
                  <OpenTicketRow
                    key={t.id}
                    t={t}
                    category={catLabel(t.categoryId)}
                    guildId={guildId}
                    claiming={claiming}
                    serverNow={serverNow}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold">
            By category{" "}
            <span className="text-xs font-normal text-faint">· 30 days</span>
          </h2>
          {stats.byCategory.length === 0 ? (
            <p className="text-sm text-faint">No tickets in this window.</p>
          ) : (
            <ul className="space-y-2.5">
              {stats.byCategory.map((c) => (
                <li key={`${c.categoryId}`}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{c.label}</span>
                    <span className="text-faint">{c.count}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(c.count / maxCat) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold">Recent activity</h2>
          {feed.length === 0 ? (
            <p className="text-sm text-faint">Nothing yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {feed.map((f, n) => (
                <li key={n} className="flex items-start gap-2.5">
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot[f.kind] ?? "bg-faint"}`}
                  />
                  <span className="min-w-0 flex-1">
                    {f.href ? (
                      <Link href={f.href} className="text-dim hover:text-ink">
                        {f.text}
                      </Link>
                    ) : (
                      <span className="text-dim">{f.text}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-faint">
                    <Relative unix={f.at} ago initial={fmtAgo(f.at)} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link className="btn-secondary" href={`/dashboard/${guildId}/general`}>
          General settings
        </Link>
        <Link
          className="btn-secondary"
          href={`/dashboard/${guildId}/categories`}
        >
          Manage categories
        </Link>
        <Link className="btn-secondary" href={`/dashboard/${guildId}/panels`}>
          Manage panels
        </Link>
        <Link
          className="btn-secondary"
          href={`/dashboard/${guildId}/transcripts`}
        >
          Transcripts
        </Link>
      </div>
    </div>
  );
}
