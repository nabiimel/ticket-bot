import Link from "next/link";
import {
  robuxCost,
  type ReservationStatus,
  type RobuxRate,
} from "@ticketbot/shared";
import { db, repos } from "@/lib/db";
import { requireGuildAccess } from "@/lib/guild-access";
import { getGuildMemberNames } from "@/lib/discord";
import { PageHeader } from "@/components/PageHeader";
import { ReservationsTable } from "@/components/ReservationsTable";

export const dynamic = "force-dynamic";

const TABS: (ReservationStatus | "all")[] = ["open", "done", "all"];

export default async function ReservationsPage({
  params,
  searchParams,
}: {
  params: { guildId: string };
  searchParams: { status?: string };
}) {
  const { guildId } = params;
  await requireGuildAccess(guildId, "console");

  const status = (TABS as string[]).includes(searchParams.status ?? "")
    ? (searchParams.status as ReservationStatus | "all")
    : "open";

  const cfg = repos.guildConfig.getGuildConfig(db(), guildId);
  const rate: RobuxRate = {
    rerollUnit: cfg.reservationsRerollUnit,
    robuxPerUnit: cfg.reservationsRobuxPerUnit,
    discountPct: cfg.reservationsDiscountPct,
  };

  // Fetch every row; the table filters by tab client-side so the budget line
  // and per-row Robux stay live while editing.
  const rows = repos.reservations.listReservations(db(), guildId, {
    limit: 2000,
  });
  const openCount = repos.reservations.countOpen(db(), guildId);

  const ticketNo = new Map<number, number>();
  for (const r of rows) {
    if (r.ticketId != null && !ticketNo.has(r.ticketId)) {
      const tk = repos.tickets.getTicket(db(), r.ticketId);
      if (tk) ticketNo.set(r.ticketId, tk.number);
    }
  }

  let names = new Map<string, string>();
  try {
    names = await getGuildMemberNames(guildId);
  } catch {
    /* offline — fall back to the captured tag */
  }

  const snippets = repos.snippets
    .listSnippets(db(), guildId)
    .map((s) => ({ id: s.id, name: s.name }));

  const data = rows.map((r) => ({
    ...r,
    buyerName:
      (r.buyerUserId ? names.get(r.buyerUserId) : null) || r.buyerTag || "—",
    addedByName: r.addedBy ? (names.get(r.addedBy) ?? null) : null,
    doneByName: r.doneBy ? (names.get(r.doneBy) ?? null) : null,
    ticketNumber:
      r.ticketId != null ? (ticketNo.get(r.ticketId) ?? null) : null,
    robuxCost: robuxCost(r.qty, rate),
  }));

  return (
    <div className="page">
      <PageHeader
        title="Reservations"
        description="Reroll orders and how much Robux each one commits."
      >
        <a
          className="btn-secondary"
          href={`/dashboard/${guildId}/reservations/export?status=${status}`}
        >
          Export spreadsheet
        </a>
      </PageHeader>

      <div className="flex gap-1 rounded-field border border-line bg-surface p-1 text-sm">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/dashboard/${guildId}/reservations${t === "open" ? "" : `?status=${t}`}`}
            className={`rounded-md px-3 py-1 capitalize transition-colors ${
              status === t
                ? "bg-accent text-white"
                : "text-dim hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {t}
            {t === "open" && openCount > 0 ? ` (${openCount})` : ""}
          </Link>
        ))}
      </div>

      <ReservationsTable
        guildId={guildId}
        tab={status}
        rows={data}
        snippets={snippets}
        rate={rate}
        budget={cfg.reservationsRobuxBudget}
        stockSyncedAt={cfg.reservationsStockSyncedAt}
      />
    </div>
  );
}
