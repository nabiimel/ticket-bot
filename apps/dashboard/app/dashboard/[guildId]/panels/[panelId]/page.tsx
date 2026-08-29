import Link from "next/link";
import { notFound } from "next/navigation";
import { db, repos } from "@/lib/db";
import { getGuildChannels, textChannels } from "@/lib/discord";
import { PanelEditor } from "@/components/PanelEditor";

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

  return (
    <div className="space-y-4">
      <Link
        href={`/dashboard/${guildId}/panels`}
        className="text-xs text-faint hover:text-dim"
      >
        ← Panels
      </Link>
      <h1 className="text-2xl font-bold">
        {panel.embed.title || `Panel #${panel.id}`}
      </h1>
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
    </div>
  );
}
