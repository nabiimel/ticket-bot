import Link from "next/link";
import type { SubmissionStatus } from "@ticketbot/shared";
import { db, repos } from "@/lib/db";
import { requireGuildAccess } from "@/lib/guild-access";
import { getGuildMemberNames, nameOf } from "@/lib/discord";
import { PageHeader } from "@/components/PageHeader";
import { SubmissionsReview } from "@/components/SubmissionsReview";

export const dynamic = "force-dynamic";

const TABS: (SubmissionStatus | "all")[] = [
  "pending",
  "approved",
  "denied",
  "all",
];

export default async function ApplicationsPage({
  params,
  searchParams,
}: {
  params: { guildId: string };
  searchParams: { status?: string };
}) {
  const { guildId } = params;
  const { level } = await requireGuildAccess(guildId, "console");

  const status = (TABS as string[]).includes(searchParams.status ?? "")
    ? (searchParams.status as SubmissionStatus | "all")
    : "pending";

  const apps = new Map(
    repos.applications
      .listApplications(db(), guildId)
      .map((a) => [a.id, a.name]),
  );
  const subs = repos.applications.listSubmissions(db(), guildId, {
    status: status === "all" ? undefined : status,
    limit: 100,
  });
  const names = await getGuildMemberNames(guildId);

  const rows = subs.map((s) => ({
    ...s,
    appName: apps.get(s.applicationId) ?? "Application",
    opener: nameOf(names, s.userId),
  }));

  return (
    <div className="page max-w-3xl">
      <PageHeader
        title="Applications"
        description="Review submissions and approve or deny."
      >
        {level !== "console" && (
          <Link
            className="btn-secondary"
            href={`/dashboard/${guildId}/applications/panels`}
          >
            Manage application panels
          </Link>
        )}
      </PageHeader>

      <div className="flex gap-1 rounded-lg border border-line bg-surface p-1 text-sm">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/dashboard/${guildId}/applications${t === "pending" ? "" : `?status=${t}`}`}
            className={`rounded-md px-3 py-1 capitalize transition-colors ${
              status === t
                ? "bg-accent text-white"
                : "text-dim hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      <SubmissionsReview guildId={guildId} rows={rows} />
    </div>
  );
}
