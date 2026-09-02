import { notFound } from "next/navigation";
import { db, repos } from "@/lib/db";
import { requireGuildAccess } from "@/lib/guild-access";
import { getGuildChannels, getGuildRoles, textChannels } from "@/lib/discord";
import { ApplicationEditor } from "@/components/ApplicationEditor";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const dynamic = "force-dynamic";

export default async function ApplicationEditPage({
  params,
}: {
  params: { guildId: string; id: string };
}) {
  const { guildId } = params;
  await requireGuildAccess(guildId, "editor");
  const app = repos.applications.getApplication(db(), Number(params.id));
  if (!app || app.guildId !== guildId) notFound();

  const [roles, channels] = await Promise.all([
    getGuildRoles(guildId),
    getGuildChannels(guildId),
  ]);

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          {
            label: "Application panels",
            href: `/dashboard/${guildId}/applications/panels`,
          },
          { label: app.name },
        ]}
      />
      <h1 className="text-2xl font-bold">{app.name}</h1>
      <ApplicationEditor
        guildId={guildId}
        app={app}
        roles={roles.map((r) => ({ id: r.id, name: r.name }))}
        textChannels={textChannels(channels).map((c) => ({
          id: c.id,
          name: c.name,
        }))}
      />
    </div>
  );
}
