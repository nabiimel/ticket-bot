import Link from "next/link";
import { db, repos } from "@/lib/db";
import { getGuildMemberNames, nameOf } from "@/lib/discord";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

function fmt(seconds: number | null): string {
  if (seconds == null) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
  return `${(s / 86400).toFixed(1)}d`;
}

function ago(sec: number): string {
  const d = Math.floor(Date.now() / 1000 - sec);
  if (d < 3600) return `${Math.max(1, Math.round(d / 60))}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
}

export default async function StatsPage({
  params,
  searchParams,
}: {
  params: { guildId: string };
  searchParams: { days?: string };
}) {
  const { guildId } = params;
  const days = Math.min(365, Math.max(1, Number(searchParams.days) || 30));
  const s = repos.stats.getGuildStats(db(), guildId, days);
  const extras = repos.stats.getStatsExtras(db(), guildId, days);
  const names = await getGuildMemberNames(guildId);
  const max = Math.max(1, ...s.byCategory.map((c) => c.count));

  // Fill the day range so the chart has a continuous axis.
  const byDay = new Map(extras.perDay.map((d) => [d.day, d.count]));
  const chart: { day: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date();
    dt.setUTCDate(dt.getUTCDate() - i);
    const key = dt.toISOString().slice(0, 10);
    chart.push({ day: key, count: byDay.get(key) ?? 0 });
  }
  const chartMax = Math.max(1, ...chart.map((d) => d.count));

  const rb = new Map(extras.ratingBreakdown.map((r) => [r.score, r.count]));
  const ratingMax = Math.max(1, ...extras.ratingBreakdown.map((r) => r.count));
  const lowRatings = (rb.get(1) ?? 0) + (rb.get(2) ?? 0);

  return (
    <div className="page">
      <PageHeader title="Stats" description={`Last ${days} days.`}>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-line bg-surface p-1 text-sm">
            {[7, 30, 90].map((d) => (
              <Link
                key={d}
                href={`?days=${d}`}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  d === days
                    ? "bg-accent text-white"
                    : "text-dim hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {d}d
              </Link>
            ))}
          </div>
          <a
            className="btn-secondary text-sm"
            href={`/dashboard/${guildId}/stats/export?days=${days}`}
          >
            Export CSV
          </a>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {[
          ["Open", String(s.openCount)],
          ["Closed", String(s.closedCount)],
          ["Total", String(s.totalCount)],
          ["Avg first response", fmt(s.avgSecondsToFirstReply)],
          ["Avg time to claim", fmt(s.avgSecondsToClaim)],
          ["Avg time to close", fmt(s.avgSecondsToClose)],
          [
            "Avg rating",
            s.avgRating != null
              ? `${s.avgRating.toFixed(2)} (${s.ratingCount})`
              : "—",
          ],
        ].map(([label, value]) => (
          <div key={label} className="stat">
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold">Tickets opened per day</h2>
        {s.totalCount === 0 ? (
          <p className="text-sm text-faint">No tickets in this window.</p>
        ) : (
          <>
            <div className="flex h-32 items-end gap-px">
              {chart.map((d) => (
                <div
                  key={d.day}
                  title={`${d.day}: ${d.count}`}
                  className="flex-1 rounded-sm bg-accent/70 transition-colors hover:bg-accent"
                  style={{
                    height: `${Math.max(2, (d.count / chartMax) * 100)}%`,
                  }}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-faint">
              <span>{chart[0]?.day}</span>
              <span>{chart[chart.length - 1]?.day}</span>
            </div>
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold">Tickets by category</h2>
          {s.byCategory.length === 0 ? (
            <p className="text-sm text-faint">No tickets in this window.</p>
          ) : (
            <div className="space-y-2.5">
              {s.byCategory.map((c) => (
                <div
                  key={String(c.categoryId)}
                  className="flex items-center gap-3"
                >
                  <span className="w-32 shrink-0 truncate text-sm text-dim">
                    {c.label}
                  </span>
                  <div className="h-2.5 grow overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(c.count / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm tabular-nums">
                    {c.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 text-sm font-semibold">
            Rating distribution
            {lowRatings > 0 && (
              <span className="ml-2 text-xs font-normal text-amber-400">
                {lowRatings} low (≤2)
              </span>
            )}
          </h2>
          {s.ratingCount === 0 ? (
            <p className="text-sm text-faint">No ratings in this window.</p>
          ) : (
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((score) => {
                const count = rb.get(score) ?? 0;
                return (
                  <div key={score} className="flex items-center gap-3 text-sm">
                    <span className="w-8 shrink-0 text-dim">{score}★</span>
                    <div className="h-2.5 grow overflow-hidden rounded-full bg-surface-2">
                      <div
                        className={`h-full rounded-full ${
                          score <= 2 ? "bg-[var(--danger)]" : "bg-accent"
                        }`}
                        style={{ width: `${(count / ratingMax) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {s.perStaff.length > 0 && (
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold">Staff activity</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-faint">
              <tr>
                <th className="pb-2">Staff</th>
                <th className="pb-2">Claimed</th>
                <th className="pb-2">Closed</th>
              </tr>
            </thead>
            <tbody>
              {s.perStaff.map((p) => (
                <tr key={p.staffId} className="border-t border-line">
                  <td className="py-1.5">{nameOf(names, p.staffId)}</td>
                  <td className="py-1.5">{p.claimed}</td>
                  <td className="py-1.5">{p.closed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {extras.comments.length > 0 && (
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold">Recent rating comments</h2>
          <ul className="space-y-3">
            {extras.comments.map((c) => (
              <li key={c.ticketId} className="text-sm">
                <div className="flex items-center gap-2 text-xs text-faint">
                  <span
                    className={
                      c.score <= 2 ? "text-[var(--danger)]" : "text-amber-400"
                    }
                  >
                    {"★".repeat(c.score)}
                  </span>
                  <Link
                    href={`/dashboard/${guildId}/transcripts/${c.ticketId}`}
                    className="hover:text-dim"
                  >
                    ticket #{c.ticketId}
                  </Link>
                  <span>· {ago(c.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-dim">{c.comment}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
