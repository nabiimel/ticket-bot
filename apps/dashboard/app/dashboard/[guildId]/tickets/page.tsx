import { db, repos } from "@/lib/db";
import { getGuildMemberNames, nameOf } from "@/lib/discord";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ConsoleFilters } from "@/components/ConsoleFilters";
import { ConsoleTicketRow } from "@/components/ConsoleTicketRow";

export const dynamic = "force-dynamic";

const SLA_UNCLAIMED_S = 30 * 60;
const SLA_NO_REPLY_S = 60 * 60;

export default async function TicketsConsole({
  params,
  searchParams,
}: {
  params: { guildId: string };
  searchParams: { state?: string; cat?: string };
}) {
  const { guildId } = params;
  const cfg = repos.guildConfig.getGuildConfig(db(), guildId);
  const categories = repos.categories.listCategories(db(), guildId);
  const names = await getGuildMemberNames(guildId);
  const claiming = cfg.claimingEnabled;
  const serverNow = Date.now() / 1000;

  const catLabel = (id: number | null) =>
    (id != null && categories.find((c) => c.id === id)?.label) ||
    "Uncategorized";

  let tickets = [...repos.tickets.listOpenTickets(db(), guildId)].sort(
    (a, b) => a.createdAt - b.createdAt,
  );

  const state = searchParams.state ?? "all";
  const catFilter = Number(searchParams.cat) || null;
  if (catFilter) tickets = tickets.filter((t) => t.categoryId === catFilter);
  if (state === "unclaimed") tickets = tickets.filter((t) => !t.claimedBy);
  else if (state === "claimed") tickets = tickets.filter((t) => t.claimedBy);
  else if (state === "flagged")
    tickets = tickets.filter((t) => {
      const age = serverNow - t.createdAt;
      return (
        (claiming && !t.claimedBy && age > SLA_UNCLAIMED_S) ||
        (!t.firstStaffMsgAt && age > SLA_NO_REPLY_S)
      );
    });

  return (
    <div className="page">
      <PageHeader
        title="Tickets"
        description="Every open ticket. Claim or close without leaving the dashboard."
      >
        <ConsoleFilters
          categories={categories.map((c) => ({ id: c.id, label: c.label }))}
        />
      </PageHeader>

      {tickets.length === 0 ? (
        <EmptyState
          title="Nothing here"
          description={
            state === "all"
              ? "No open tickets right now."
              : "No open tickets match this filter."
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-faint">
              <tr>
                <th className="pb-2 pr-3 font-medium">Ticket</th>
                <th className="pb-2 pr-3 font-medium">Type</th>
                <th className="pb-2 pr-3 font-medium">Opener</th>
                <th className="pb-2 pr-3 font-medium">Status</th>
                <th className="pb-2 pr-3 font-medium">Age</th>
                <th className="pb-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tickets.map((t) => (
                <ConsoleTicketRow
                  key={t.id}
                  t={t}
                  category={catLabel(t.categoryId)}
                  opener={nameOf(names, t.openerId)}
                  guildId={guildId}
                  claiming={claiming}
                  serverNow={serverNow}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
