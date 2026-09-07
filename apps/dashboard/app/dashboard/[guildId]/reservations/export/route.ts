import ExcelJS from "exceljs";
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

const fmtDate = (sec: number | null) =>
  sec == null ? "" : new Date(sec * 1000);

const INK = "FF1F2430";
const HEADER_FILL = "FFEDEEF2";
const LINE = "FFD9DCE3";

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
    /* offline — fall back to ids */
  }
  const nm = (id: string | null) => (id ? (names.get(id) ?? id) : "");

  const ticketNo = new Map<number, number>();
  for (const r of rows) {
    if (r.ticketId != null && !ticketNo.has(r.ticketId)) {
      const tk = repos.tickets.getTicket(db(), r.ticketId);
      if (tk) ticketNo.set(r.ticketId, tk.number);
    }
  }

  const committed = rows
    .filter((r) => r.status !== "cancelled")
    .reduce((sum, r) => sum + robuxCost(r.qty, rate), 0);
  const budget = cfg.reservationsRobuxBudget;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Ticket Bot";
  wb.created = new Date();
  const ws = wb.addWorksheet("Reservations", {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  ws.columns = [
    { key: "gakuran", width: 22 },
    { key: "roblox", width: 22 },
    { key: "rr", width: 10 },
    { key: "robux", width: 12 },
    { key: "paid", width: 10 },
    { key: "done", width: 10 },
    { key: "ticket", width: 10 },
    { key: "added", width: 20 },
    { key: "fulfilled", width: 20 },
  ];

  // --- Summary block (rows 1–3) ---
  const summary: [string, number | string][] = [
    ["Available Robux", budget],
    ["Committed", committed],
    ["Remaining", budget - committed],
  ];
  summary.forEach(([label, value], i) => {
    const row = ws.getRow(i + 1);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true, color: { argb: INK } };
    const v = row.getCell(2);
    v.value = value;
    v.numFmt = "#,##0";
    v.alignment = { horizontal: "left" };
    if (label === "Remaining" && typeof value === "number" && value < 0) {
      v.font = { bold: true, color: { argb: "FFC0392B" } };
    } else if (label === "Remaining") {
      v.font = { bold: true, color: { argb: "FF1E7E34" } };
    }
  });

  // Row 4 blank, row 5 = header.
  const HEADERS = [
    "Gakuran Name",
    "Roblox User",
    "RR's",
    "Robux",
    "Paid",
    "Done",
    "Ticket",
    "Added",
    "Fulfilled",
  ];
  const headerRow = ws.getRow(5);
  HEADERS.forEach((h, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: INK } };
    c.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL },
    };
    c.alignment = {
      vertical: "middle",
      horizontal: i >= 2 ? "center" : "left",
    };
    c.border = { bottom: { style: "thin", color: { argb: LINE } } };
  });
  headerRow.height = 20;

  // --- Data rows (from row 6) ---
  rows.forEach((r) => {
    const row = ws.addRow({
      gakuran: r.gakuranName || nm(r.buyerUserId) || r.buyerTag || "",
      roblox: r.robloxUser || "",
      rr: r.qty,
      robux: robuxCost(r.qty, rate),
      paid: r.paid ? "Yes" : "No",
      done: r.status === "done" ? "Yes" : "No",
      ticket:
        r.ticketId != null
          ? `#${ticketNo.get(r.ticketId) ?? r.ticketId}`
          : "walk-in",
      added: fmtDate(r.addedAt),
      fulfilled: fmtDate(r.doneAt),
    });
    row.getCell("rr").numFmt = "#,##0";
    row.getCell("robux").numFmt = "#,##0";
    row.getCell("rr").alignment = { horizontal: "center" };
    row.getCell("robux").alignment = { horizontal: "center" };
    row.getCell("paid").alignment = { horizontal: "center" };
    row.getCell("done").alignment = { horizontal: "center" };
    row.getCell("ticket").alignment = { horizontal: "center" };
    row.getCell("added").numFmt = "yyyy-mm-dd hh:mm";
    row.getCell("fulfilled").numFmt = "yyyy-mm-dd hh:mm";
    for (let i = 1; i <= HEADERS.length; i++) {
      row.getCell(i).border = {
        bottom: { style: "hair", color: { argb: LINE } },
      };
    }
  });

  // Totals row.
  if (rows.length > 0) {
    const first = 6;
    const last = 5 + rows.length;
    const totals = ws.addRow({
      gakuran: `${rows.length} reservation(s)`,
      rr: { formula: `SUM(C${first}:C${last})` },
      robux: { formula: `SUM(D${first}:D${last})` },
    });
    totals.font = { bold: true };
    totals.getCell("rr").numFmt = "#,##0";
    totals.getCell("robux").numFmt = "#,##0";
    totals.getCell("rr").alignment = { horizontal: "center" };
    totals.getCell("robux").alignment = { horizontal: "center" };
    totals.eachCell(
      (c) => (c.border = { top: { style: "thin", color: { argb: LINE } } }),
    );
  }

  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: 9 } };

  const buf = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `reservations-${stamp}${status ? `-${status}` : ""}.xlsx`;
  return new Response(buf, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
