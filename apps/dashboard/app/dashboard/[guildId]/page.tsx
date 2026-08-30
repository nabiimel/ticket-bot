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

  // Ordered first-run checklist. All steps are always shown until every one is
  // done, so a new admin can see how far along they are.
  const setupSteps = [
    {
      done:
        !!cfg.defaultStaffRoleId ||
        categories.some((c) => c.staffRoleIds.length > 0),
      label: "Give staff a role that can see tickets",
      href: `/dashboard/${guildId}/general`,
    },
    {
      done: !!cfg.logChannelId,
      label: "Choose a log channel",
      href: `/dashboard/${guildId}/general`,
    },
    {
      done: categories.length > 0,
      label: "Create a ticket category",
      href: `/dashboard/${guildId}/categories`,
    },
    {
      done: panels.length > 0,
      label: "Build a panel",
      href: `/dashboard/${guildId}/panels`,
    },
    {
      done: panels.some((p) => p.status === "published" && p.channelId),
      label: "Publish the panel to a channel",
      href: `/dashboard/${guildId}/panels`,
    },
  ];
  const setupDone = setupSteps.filter((s) => s.done).length;

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

      {setupDone < setupSteps.length && (
        <div className="note note-warn">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--warn-border)] text-xs">
              !
            </span>
            Finish setting up
            <span className="text-xs font-normal opacity-70">
              {setupDone}/{setupSteps.length} done
            </span>
          </h2>
          <ol className="space-y-1.5 text-sm">
            {setupSteps.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className={`mt-px shrink-0 ${s.done ? "" : "opacity-60"}`}
                  aria-hidden
                >
                  {s.done ? "✓" : `${i + 1}.`}
                </span>
                {s.done ? (
                  <span className="opacity-60 line-through">{s.label}</span>
                ) : (
                  <Link
                    href={s.href}
                    className="underline-offset-2 hover:underline"
                  >
                    {s.label}
                  </Link>
                )}
              </li>
            ))}
          </ol>
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
                    slaUnclaimedS={cfg.slaUnclaimedMins * 60}
                    slaNoReplyS={cfg.slaNoReplyMins * 60}
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
