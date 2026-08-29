import { db, repos } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { MarkSeen } from "@/components/MarkSeen";

export const dynamic = "force-dynamic";

export default function TranscriptsPage({
  params,
}: {
  params: { guildId: string };
}) {
  const { guildId } = params;
  const tickets = repos.tickets.listClosedTickets(db(), guildId, 100);

  return (
    <div className="page">
      <MarkSeen cookie={`tx_seen_${guildId}`} />
      <PageHeader
        title="Transcripts"
        description="Saved HTML logs of every closed ticket."
      />
      {tickets.length === 0 && (
        <EmptyState
          title="No closed tickets yet"
          description="Once a ticket is closed, its full HTML transcript appears here."
        />
      )}

      <ul className="divide-row overflow-hidden rounded-xl border border-line bg-surface empty:hidden">
        {tickets.map((tk) => (
          <li
            key={tk.id}
            className="flex items-center justify-between p-4 transition-colors hover:bg-surface-2"
          >
            <div>
              <div className="font-medium">Ticket #{tk.number}</div>
              <div className="text-xs text-faint">
                opened by {tk.openerId} ·{" "}
                {tk.closedAt
                  ? new Date(tk.closedAt * 1000).toLocaleString()
                  : "—"}
                {tk.closeReason ? ` · ${tk.closeReason}` : ""}
              </div>
            </div>
            <a
              className="btn-secondary"
              href={`/dashboard/${guildId}/transcripts/${tk.id}`}
              target="_blank"
              rel="noreferrer"
            >
              Open
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
