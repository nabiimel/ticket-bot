import { db, repos } from "@/lib/db";
import { requireGuildAccess } from "@/lib/guild-access";
import { getGuildRoles } from "@/lib/discord";
import { PageHeader } from "@/components/PageHeader";
import { PermissionsEditor } from "@/components/PermissionsEditor";

export const dynamic = "force-dynamic";

export default async function PermissionsPage({
  params,
}: {
  params: { guildId: string };
}) {
  const { guildId } = params;
  await requireGuildAccess(guildId, "admin");

  const roles = (await getGuildRoles(guildId)).filter((r) => !r.managed);
  const grants = Object.fromEntries(
    repos.dashboardGrants
      .listGrants(db(), guildId)
      .map((g) => [g.roleId, g.level]),
  );

  return (
    <div className="page max-w-4xl">
      <PageHeader
        title="Dashboard permissions"
        description="Give staff dashboard access by Discord role — no Manage Server needed."
      />
      <PermissionsEditor guildId={guildId} roles={roles} grants={grants} />
    </div>
  );
}
