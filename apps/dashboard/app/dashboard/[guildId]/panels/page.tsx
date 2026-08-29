import Link from "next/link";
import { redirect } from "next/navigation";
import { db, repos } from "@/lib/db";
import { createPanel } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default function PanelsPage({
  params,
}: {
  params: { guildId: string };
}) {
  const { guildId } = params;
  const panels = repos.panels.listPanels(db(), guildId);

  async function create() {
    "use server";
    const res = await createPanel(guildId);
    if (res.ok && res.id) redirect(`/dashboard/${guildId}/panels/${res.id}`);
  }

  return (
    <div className="page max-w-2xl">
      <PageHeader
        title="Panels"
        description="The messages people click to open a ticket."
      >
        <form action={create}>
          <SubmitButton>New panel</SubmitButton>
        </form>
      </PageHeader>

      <ul className="divide-row overflow-hidden rounded-xl border border-line bg-surface">
        {panels.length === 0 && (
          <li className="p-4 text-sm text-faint">No panels yet.</li>
        )}
        {panels.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between p-4 transition-colors hover:bg-surface-2"
          >
            <div>
              <div className="font-medium">
                {p.embed.title || `Panel #${p.id}`}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-faint">
                <span>#{p.id}</span>
                <span>·</span>
                <span>{p.style}</span>
                <span>·</span>
                <span>
                  {p.categoryIds.length} categor
                  {p.categoryIds.length === 1 ? "y" : "ies"}
                </span>
                <span
                  className={
                    p.status === "published"
                      ? "badge badge-green"
                      : "badge badge-amber"
                  }
                >
                  {p.status}
                </span>
              </div>
            </div>
            <Link
              className="btn-secondary"
              href={`/dashboard/${guildId}/panels/${p.id}`}
            >
              Edit
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
