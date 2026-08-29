import Link from "next/link";
import { db, repos } from "@/lib/db";
import { guildHealth } from "@/lib/health";
import { PageHeader } from "@/components/PageHeader";

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
  const issues = await guildHealth(guildId);

  const setup: string[] = [];
  if (!cfg.logChannelId) setup.push("Set a log channel in General");
  if (!cfg.transcriptChannelId)
    setup.push("Set a transcript channel in General");
  if (categories.length === 0) setup.push("Create a ticket category");
  if (panels.filter((p) => p.status === "published").length === 0)
    setup.push("Publish a panel");

  const errors = issues.filter((i) => i.level === "error");
  const warns = issues.filter((i) => i.level === "warn");

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

      {issues.length > 0 && (
        <div className="card border-[rgba(237,66,69,.35)] bg-[rgba(237,66,69,.05)]">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-red-300">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-red-500/20 text-xs">
              !
            </span>
            Needs attention
            <span className="text-xs font-normal text-faint">
              {errors.length} error{errors.length === 1 ? "" : "s"} ·{" "}
              {warns.length} warning{warns.length === 1 ? "" : "s"}
            </span>
          </h2>
          <ul className="space-y-1.5 text-sm">
            {issues.map((i, n) => (
              <li key={n} className="flex items-start gap-2">
                <span
                  className={
                    i.level === "error"
                      ? "mt-0.5 text-red-400"
                      : "mt-0.5 text-amber-400"
                  }
                >
                  {i.level === "error" ? "✕" : "▲"}
                </span>
                <Link href={i.href} className="text-dim hover:text-ink">
                  {i.message}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {setup.length > 0 && (
        <div className="card border-amber-500/30 bg-amber-500/[0.04]">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-amber-200">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-amber-500/20 text-xs">
              !
            </span>
            Finish setting up
          </h2>
          <ul className="ml-7 list-disc space-y-1 text-sm text-amber-100/80">
            {setup.map((n) => (
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
