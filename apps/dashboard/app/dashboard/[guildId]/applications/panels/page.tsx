import Link from "next/link";
import { redirect } from "next/navigation";
import { db, repos } from "@/lib/db";
import { requireGuildAccess } from "@/lib/guild-access";
import { createApplication } from "../../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function ApplicationPanelsPage({
  params,
}: {
  params: { guildId: string };
}) {
  const { guildId } = params;
  await requireGuildAccess(guildId, "editor");
  const apps = repos.applications.listApplications(db(), guildId);

  async function create() {
    "use server";
    const res = await createApplication(guildId);
    if (res.ok && res.id)
      redirect(`/dashboard/${guildId}/applications/panels/${res.id}`);
  }

  return (
    <div className="page max-w-4xl">
      <PageHeader
        title="Application panels"
        description="Each collects a form and routes it to reviewers."
      >
        <form action={create}>
          <SubmitButton>New application</SubmitButton>
        </form>
      </PageHeader>

      {apps.length === 0 ? (
        <EmptyState
          title="No applications yet"
          description="Create one for staff recruitment, partner forms, or whitelist requests."
        />
      ) : (
        <ul className="divide-row overflow-hidden rounded-xl border border-line bg-surface">
          {apps.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between p-4 transition-colors hover:bg-surface-2"
            >
              <div>
                <div className="font-medium">{a.name}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-faint">
                  <span>{a.questions.length} question(s)</span>
                  <span>·</span>
                  <span>{a.reviewerRoleIds.length} reviewer role(s)</span>
                  <span
                    className={
                      a.status === "published"
                        ? "badge badge-green"
                        : "badge badge-amber"
                    }
                  >
                    {a.status}
                  </span>
                </div>
              </div>
              <Link
                className="btn-secondary"
                href={`/dashboard/${guildId}/applications/panels/${a.id}`}
              >
                Edit
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
