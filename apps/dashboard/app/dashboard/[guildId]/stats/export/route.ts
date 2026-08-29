import { db, repos } from "@/lib/db";
import { checkGuildAccess } from "@/lib/guild-access";

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
  if (!access) {
    return new Response("Unauthorized", { status: 401 });
  }

  const days = Math.min(
    365,
    Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 30),
  );
  const rows = repos.stats.getStatsExportRows(db(), params.guildId, days);

  const header = [
    "number",
    "category",
    "opener_id",
    "opened_at",
    "claimed_at",
    "first_staff_reply_at",
    "closed_at",
    "closed_by",
    "close_reason",
    "rating",
    "first_response_seconds",
    "resolution_seconds",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.number,
        r.category,
        r.openerId,
        iso(r.createdAt),
        iso(r.claimedAt),
        iso(r.firstStaffMsgAt),
        iso(r.closedAt),
        r.closedBy,
        r.closeReason,
        r.rating,
        r.firstStaffMsgAt ? r.firstStaffMsgAt - r.createdAt : "",
        r.closedAt ? r.closedAt - r.createdAt : "",
      ]
        .map(csvCell)
        .join(","),
    );
  }

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="tickets-${params.guildId}-${days}d.csv"`,
      "cache-control": "no-store",
    },
  });
}
