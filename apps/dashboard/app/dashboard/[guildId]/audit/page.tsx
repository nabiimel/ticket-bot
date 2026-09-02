import { db, repos } from "@/lib/db";
import { requireGuildAccess } from "@/lib/guild-access";
import { getGuildMemberNames, nameOf } from "@/lib/discord";
import { PageHeader } from "@/components/PageHeader";
import { LocalTime } from "@/components/LocalTime";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  params,
}: {
  params: { guildId: string };
}) {
  await requireGuildAccess(params.guildId, "admin");
  const rows = repos.audit.listAudit(db(), params.guildId, 200);
  const names = await getGuildMemberNames(params.guildId);

  return (
    <div className="page">
      <PageHeader
        title="Audit log"
        description="Configuration changes made through this dashboard, most recent first."
      />
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs text-faint">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-faint" colSpan={4}>
                  Nothing recorded yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="whitespace-nowrap px-3 py-2 text-dim">
                  <LocalTime
                    unix={r.createdAt}
                    initial={new Date(r.createdAt * 1000).toLocaleString()}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">
                  {nameOf(names, r.actorId)}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <code className="text-discord-blurple">{r.action}</code>
                </td>
                <td className="px-3 py-2">{r.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
