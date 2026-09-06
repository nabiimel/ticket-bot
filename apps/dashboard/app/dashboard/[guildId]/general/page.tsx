import { db, repos } from "@/lib/db";
import { requireGuildAccess } from "@/lib/guild-access";
import {
  categoryChannels,
  getGuildChannels,
  getGuildMemberNames,
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
  await requireGuildAccess(guildId, "editor");
  const cfg = repos.guildConfig.ensureGuildConfig(db(), guildId);
  const [roles, channels, memberNames] = await Promise.all([
    getGuildRoles(guildId),
    getGuildChannels(guildId),
    getGuildMemberNames(guildId).catch(() => new Map<string, string>()),
  ]);

  // Seller can be a role or a user — one combined picker.
  const sellerOptions = [
    ...roles.map((r) => ({ id: r.id, name: `@${r.name} (role)` })),
    ...[...memberNames.entries()]
      .map(([id, name]) => ({ id, name: `${name}` }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  ];

  return (
    <div className="page max-w-4xl">
      <PageHeader
        title="General settings"
        description="Channels, roles, and behaviour that apply to every ticket."
      />
      <GeneralForm
        guildId={guildId}
        cfg={cfg}
        roles={roles.map((r) => ({ id: r.id, name: r.name }))}
        sellerOptions={sellerOptions}
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
