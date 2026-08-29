import { db, repos } from "@/lib/db";
import { removeBlacklist } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { BlacklistAddForm } from "@/components/BlacklistAddForm";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default function BlacklistPage({
  params,
}: {
  params: { guildId: string };
}) {
  const { guildId } = params;
  const rows = repos.blacklist.listBlacklist(db(), guildId);

  return (
    <div className="page max-w-2xl">
      <PageHeader
        title="Blacklist"
        description="Blocked users can't open tickets. Use their Discord user ID (Developer Mode → right-click → Copy User ID)."
      />

      <BlacklistAddForm guildId={guildId} />

      <ul className="divide-row overflow-hidden rounded-xl border border-line bg-surface">
        {rows.length === 0 && (
          <li className="p-4 text-sm text-faint">No blocked users.</li>
        )}
        {rows.map((r) => (
          <li
            key={r.userId}
            className="flex items-center justify-between p-4 transition-colors hover:bg-surface-2"
          >
            <div>
              <div className="font-mono text-sm">{r.userId}</div>
              {r.reason && <div className="text-xs text-faint">{r.reason}</div>}
            </div>
            <form action={removeBlacklist.bind(null, guildId, r.userId)}>
              <SubmitButton className="btn-secondary">Unblock</SubmitButton>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
