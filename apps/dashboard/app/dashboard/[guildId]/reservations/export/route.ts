import {
  robuxCost,
  type ReservationStatus,
  type RobuxRate,
} from "@ticketbot/shared";
import { db, repos } from "@/lib/db";
import { checkGuildAccess } from "@/lib/guild-access";
import { getGuildMemberNames } from "@/lib/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(v: string | number | null): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const iso = (sec: number | null) =>
  sec == null ? "" : new Date(sec * 1000).toISOString();

export async function GET(
  req: Request,
  { params }: { params: { guildId: string } },
) {
  const access = await checkGuildAccess(params.guildId);
  if (!access) return new Response("Unauthorized", { status: 401 });

  const raw = new URL(req.url).searchParams.get("status") ?? "";
  const status = (["open", "done", "cancelled"] as string[]).includes(raw)
    ? (raw as ReservationStatus)
    : undefined;

  const rows = repos.reservations.listReservations(db(), params.guildId, {
    status,
    limit: 2000,
  });
  const cfg = repos.guildConfig.getGuildConfig(db(), params.guildId);
  const rate: RobuxRate = {
    rerollUnit: cfg.reservationsRerollUnit,
    robuxPerUnit: cfg.reservationsRobuxPerUnit,
    discountPct: cfg.reservationsDiscountPct,
  };

  let names = new Map<string, string>();
  try {
    names = await getGuildMemberNames(params.guildId);
  } catch {
    /* offline */
  }
  const nm = (id: string | null) => (id ? (names.get(id) ?? id) : "");

  const header = [
    "id",
    "gakuran_name",
    "roblox_user",
    "buyer_id",
    "rerolls",
    "robux",
    "paid",
    "status",
    "ticket_id",
    "added_by",
    "added_at",
    "done_by",
    "done_at",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.gakuranName || nm(r.buyerUserId) || r.buyerTag,
        r.robloxUser,
        r.buyerUserId,
        r.qty,
        robuxCost(r.qty, rate),
        r.paid ? "yes" : "no",
        r.status,
        r.ticketId,
        nm(r.addedBy),
        iso(r.addedAt),
        nm(r.doneBy),
        iso(r.doneAt),
      ]
        .map(csvCell)
        .join(","),
    );
  }

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="reservations-${params.guildId}${status ? `-${status}` : ""}.csv"`,
      "cache-control": "no-store",
    },
  });
}
