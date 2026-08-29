import { db, repos } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";

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
      <PageHeader
        title="Transcripts"
        description="Saved HTML logs of every closed ticket."
      />
      <ul className="divide-row overflow-hidden rounded-xl border border-line bg-surface">
        {tickets.length === 0 && (
          <li className="p-4 text-sm text-faint">No closed tickets yet.</li>
        )}
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
