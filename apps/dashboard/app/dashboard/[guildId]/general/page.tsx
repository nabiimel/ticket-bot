import { db, repos } from "@/lib/db";
import {
  categoryChannels,
  getGuildChannels,
  getGuildRoles,
  textChannels,
} from "@/lib/discord";
import { GeneralForm } from "@/components/GeneralForm";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function GeneralPage({
  params,
}: {
  params: { guildId: string };
}) {
  const { guildId } = params;
  const cfg = repos.guildConfig.ensureGuildConfig(db(), guildId);
  const [roles, channels] = await Promise.all([
    getGuildRoles(guildId),
    getGuildChannels(guildId),
  ]);

  return (
    <div className="page max-w-2xl">
      <PageHeader
        title="General settings"
        description="Channels, roles, and behaviour that apply to every ticket."
      />
      <GeneralForm
        guildId={guildId}
        cfg={cfg}
        roles={roles.map((r) => ({ id: r.id, name: r.name }))}
        textChannels={textChannels(channels).map((c) => ({
          id: c.id,
          name: c.name,
        }))}
        categoryChannels={categoryChannels(channels).map((c) => ({
          id: c.id,
          name: c.name,
        }))}
      />
    </div>
  );
}
