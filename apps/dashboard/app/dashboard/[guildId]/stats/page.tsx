import Link from "next/link";
import { db, repos } from "@/lib/db";
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

export default function StatsPage({
  params,
  searchParams,
}: {
  params: { guildId: string };
  searchParams: { days?: string };
}) {
  const { guildId } = params;
  const days = Math.min(365, Math.max(1, Number(searchParams.days) || 30));
  const s = repos.stats.getGuildStats(db(), guildId, days);
  const max = Math.max(1, ...s.byCategory.map((c) => c.count));

  return (
    <div className="page">
      <PageHeader title="Stats" description={`Last ${days} days.`}>
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
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          ["Open", String(s.openCount)],
          ["Closed", String(s.closedCount)],
          ["Total", String(s.totalCount)],
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
        <h2 className="mb-3 text-sm font-semibold">Tickets by category</h2>
        {s.byCategory.length === 0 && (
          <p className="text-sm text-faint">No tickets in this window.</p>
        )}
        <div className="space-y-2.5">
          {s.byCategory.map((c) => (
            <div key={String(c.categoryId)} className="flex items-center gap-3">
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
                  <td className="py-1.5 font-mono text-xs">{p.staffId}</td>
                  <td className="py-1.5">{p.claimed}</td>
                  <td className="py-1.5">{p.closed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
