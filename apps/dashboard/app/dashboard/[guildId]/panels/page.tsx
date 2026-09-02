import Link from "next/link";
import { requireGuildAccess } from "@/lib/guild-access";
import { redirect } from "next/navigation";
import { db, repos } from "@/lib/db";
import { getGuildChannels } from "@/lib/discord";
import { createPanel } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { PanelsBoard } from "@/components/PanelsBoard";

export const dynamic = "force-dynamic";

export default async function PanelsPage({
  params,
  searchParams,
}: {
  params: { guildId: string };
  searchParams: { view?: string };
}) {
  const { guildId } = params;
  await requireGuildAccess(guildId, "editor");
  const panels = repos.panels.listPanels(db(), guildId);
  const categories = repos.categories.listCategories(db(), guildId);
  const view = searchParams.view === "list" ? "list" : "board";

  async function create() {
    "use server";
    const res = await createPanel(guildId);
    if (res.ok && res.id) redirect(`/dashboard/${guildId}/panels/${res.id}`);
  }

  let channelName = new Map<string, string>();
  if (view === "board" && panels.length > 0) {
    try {
      const chans = await getGuildChannels(guildId);
      channelName = new Map(chans.map((c) => [c.id, c.name]));
    } catch {
      /* offline — show "no channel" rather than fail the page */
    }
  }

  const Toggle = () => (
    <div className="flex gap-1 rounded-lg border border-line bg-surface p-1 text-sm">
      {(["board", "list"] as const).map((v) => (
        <Link
          key={v}
          href={`/dashboard/${guildId}/panels${v === "list" ? "?view=list" : ""}`}
          className={`rounded-md px-2.5 py-1 font-medium capitalize transition-colors ${
            view === v
              ? "bg-accent text-white"
              : "text-dim hover:bg-surface-2 hover:text-ink"
          }`}
        >
          {v}
        </Link>
      ))}
    </div>
  );

  return (
    <div className={`page ${view === "list" ? "max-w-2xl" : ""}`}>
      <PageHeader
        title="Panels"
        description="The messages people click to open a ticket."
      >
        <Toggle />
        <form action={create}>
          <SubmitButton>New panel</SubmitButton>
        </form>
      </PageHeader>

      {panels.length === 0 ? (
        <EmptyState
          title="No panels yet"
          description="A panel is the message people click to open a ticket. Create one, add your categories, and publish it to a channel."
        />
      ) : view === "board" ? (
        <>
          <p className="text-xs text-faint">
            Drag a ticket type from the left onto a panel to add it. Drag inside
            a panel to reorder. Changes save immediately and re-post any live
            panel.
          </p>
          <PanelsBoard
            guildId={guildId}
            categories={categories.map((c) => ({
              id: c.id,
              label: c.label,
              emoji: c.emoji,
            }))}
            panels={panels.map((p) => ({
              id: p.id,
              title: p.embed.title || `Panel #${p.id}`,
              channelId: p.channelId,
              channelName: p.channelId
                ? (channelName.get(p.channelId) ?? null)
                : null,
              status: p.status,
              categoryIds: p.categoryIds,
            }))}
          />
        </>
      ) : (
        <ul className="divide-row overflow-hidden rounded-xl border border-line bg-surface">
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
      )}
    </div>
  );
}
