import Link from "next/link";
import { db, repos } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default function Overview({ params }: { params: { guildId: string } }) {
  const { guildId } = params;
  const cfg = repos.guildConfig.getGuildConfig(db(), guildId);
  const stats = repos.stats.getGuildStats(db(), guildId, 30);
  const categories = repos.categories.listCategories(db(), guildId);
  const panels = repos.panels.listPanels(db(), guildId);

  const needs: string[] = [];
  if (!cfg.logChannelId) needs.push("Set a log channel in General");
  if (!cfg.transcriptChannelId)
    needs.push("Set a transcript channel in General");
  if (categories.length === 0) needs.push("Create a ticket category");
  if (panels.filter((p) => p.status === "published").length === 0)
    needs.push("Publish a panel");

  return (
    <div className="page">
      <PageHeader
        title="Overview"
        description="A snapshot of this server's ticket system."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Open tickets", stats.openCount],
          ["Closed · 30d", stats.closedCount],
          ["Categories", categories.length],
          ["Panels", panels.length],
        ].map(([label, n]) => (
          <div key={label} className="stat">
            <div className="stat-value">{n}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {needs.length > 0 && (
        <div className="card border-amber-500/30 bg-amber-500/[0.04]">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-amber-200">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-amber-500/20 text-xs">
              !
            </span>
            Finish setting up
          </h2>
          <ul className="ml-7 list-disc space-y-1 text-sm text-amber-100/80">
            {needs.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

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
      </div>
    </div>
  );
}
