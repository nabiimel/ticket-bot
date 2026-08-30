import { notFound } from "next/navigation";
import { db, repos } from "@/lib/db";
import { getGuildChannels, textChannels } from "@/lib/discord";
import { PanelEditor } from "@/components/PanelEditor";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const dynamic = "force-dynamic";

export default async function PanelEditPage({
  params,
}: {
  params: { guildId: string; panelId: string };
}) {
  const { guildId } = params;
  const panel = repos.panels.getPanel(db(), Number(params.panelId));
  if (!panel || panel.guildId !== guildId) notFound();

  const categories = repos.categories.listCategories(db(), guildId);
  const channels = await getGuildChannels(guildId);
  const stats = repos.panelStats.getPanelStats(db(), panel.id);
  const catLabel = (id: number) =>
    categories.find((c) => c.id === id)?.label ?? `#${id}`;
  const totalClicks = stats.reduce((n, s) => n + s.clicks, 0);

  const title = panel.embed.title || `Panel #${panel.id}`;

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          { label: "Panels", href: `/dashboard/${guildId}/panels` },
          { label: title },
        ]}
      />
      <h1 className="text-2xl font-bold">{title}</h1>
      <PanelEditor
        guildId={guildId}
        panel={panel}
        categories={categories.map((c) => ({
          id: c.id,
          label: c.label,
          emoji: c.emoji,
        }))}
        textChannels={textChannels(channels).map((c) => ({
          id: c.id,
          name: c.name,
        }))}
      />

      <div className="card">
        <h2 className="mb-1 font-semibold">Usage</h2>
        <p className="mb-3 text-xs text-faint">
          Button / dropdown presses and how many became tickets. Counts start
          once the panel is re-published with the current bot version.
        </p>
        {totalClicks === 0 ? (
          <p className="text-sm text-faint">No clicks recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-faint">
                <tr>
                  <th className="pb-2 pr-3 font-medium">Ticket type</th>
                  <th className="pb-2 pr-3 text-right font-medium">Clicks</th>
                  <th className="pb-2 pr-3 text-right font-medium">Opened</th>
                  <th className="pb-2 text-right font-medium">Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {stats.map((s) => (
                  <tr key={s.categoryId}>
                    <td className="py-2 pr-3">{catLabel(s.categoryId)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {s.clicks}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {s.opens}
                    </td>
                    <td className="py-2 text-right tabular-nums text-dim">
                      {s.clicks > 0
                        ? `${Math.round((s.opens / s.clicks) * 100)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
