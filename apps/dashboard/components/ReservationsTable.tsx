"use client";

import { useMemo, useState, useTransition } from "react";
import {
  robuxCost,
  type ReservationRecord,
  type ReservationStatus,
  type RobuxRate,
} from "@ticketbot/shared";
import { fmtAgo } from "@/lib/format";
import {
  addReservation,
  bulkSendSnippetToReservations,
  deleteReservation,
  setReservationDone,
  setReservationsBudget,
  updateReservation,
} from "@/app/dashboard/[guildId]/actions";
import { EmptyState } from "./EmptyState";
import { useToast } from "./Toast";
import { useConfirm } from "./ConfirmDialog";

type Row = ReservationRecord & {
  buyerName: string;
  addedByName: string | null;
  doneByName: string | null;
  ticketNumber: number | null;
  robuxCost: number;
};

const nf = new Intl.NumberFormat("en-US");

export function ReservationsTable({
  guildId,
  tab,
  rows,
  snippets,
  rate,
  budget,
}: {
  guildId: string;
  tab: ReservationStatus | "all";
  rows: Row[];
  snippets: { id: number; name: string }[];
  rate: RobuxRate;
  budget: number;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState("");
  const [local, setLocal] = useState<Record<number, Partial<Row>>>({});
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [snippetId, setSnippetId] = useState<number | "">("");
  const [markDone, setMarkDone] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState<number>(budget);

  const costOf = (qty: number) => robuxCost(qty, rate);

  const merged = useMemo(
    () => rows.map((r) => ({ ...r, ...local[r.id] })),
    [rows, local],
  );

  // Committed Robux spans every row (not just the current tab).
  const committed = merged
    .filter((r) => !removed.has(r.id) && r.status !== "cancelled")
    .reduce((sum, r) => sum + costOf(r.qty), 0);
  const remaining = budgetDraft - committed;

  const visible = merged.filter((r) => {
    if (removed.has(r.id)) return false;
    if (tab !== "all" && r.status !== tab) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !(r.gakuranName || r.buyerName).toLowerCase().includes(q) &&
        !r.robloxUser.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const patch = (id: number, p: Partial<Row>) =>
    setLocal((s) => ({ ...s, [id]: { ...s[id], ...p } }));

  const toggleSel = (id: number, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  const visibleIds = visible.map((r) => r.id);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const saveBudget = (value: number) => {
    const n = Math.max(Math.trunc(value) || 0, 0);
    setBudgetDraft(n);
    if (n === budget) return;
    start(async () => {
      const res = await setReservationsBudget(guildId, n);
      if (!res.ok) {
        setBudgetDraft(budget);
        toast.error(res.error ?? "Couldn't save budget");
      } else {
        toast.success("Budget updated");
      }
    });
  };

  const toggleDone = (r: Row, done: boolean) => {
    patch(r.id, { status: done ? "done" : "open" });
    start(async () => {
      const res = await setReservationDone(guildId, r.id, done);
      if (!res.ok) {
        patch(r.id, { status: r.status });
        toast.error(res.error ?? "Couldn't update");
      }
    });
  };

  const togglePaid = (r: Row, paid: boolean) => {
    patch(r.id, { paid });
    start(async () => {
      const res = await updateReservation(guildId, r.id, { paid });
      if (!res.ok) {
        patch(r.id, { paid: r.paid });
        toast.error(res.error ?? "Couldn't update");
      }
    });
  };

  const saveField = (
    r: Row,
    field: "gakuranName" | "robloxUser" | "qty",
    raw: string,
  ) => {
    if (field === "qty") {
      const next = Math.max(parseInt(raw || "0", 10) || 0, 0);
      if (r.qty === next) return;
      patch(r.id, { qty: next });
      start(async () => {
        const res = await updateReservation(guildId, r.id, { qty: next });
        if (!res.ok) toast.error(res.error ?? "Couldn't save");
      });
      return;
    }
    const next = raw.trim();
    if (r[field] === next) return;
    const p =
      field === "gakuranName" ? { gakuranName: next } : { robloxUser: next };
    patch(r.id, p);
    start(async () => {
      const res = await updateReservation(guildId, r.id, p);
      if (!res.ok) toast.error(res.error ?? "Couldn't save");
    });
  };

  const remove = async (r: Row) => {
    const ok = await confirm({
      title: "Delete reservation?",
      message: `This removes the row for ${r.gakuranName || r.buyerName}. It can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setRemoved((s) => new Set(s).add(r.id));
    setSelected((s) => {
      const n = new Set(s);
      n.delete(r.id);
      return n;
    });
    start(async () => {
      const res = await deleteReservation(guildId, r.id);
      if (!res.ok) {
        setRemoved((s) => {
          const n = new Set(s);
          n.delete(r.id);
          return n;
        });
        toast.error(res.error ?? "Couldn't delete");
      }
    });
  };

  const submitWalkIn = (form: FormData) => {
    const gakuranName = String(form.get("gakuranName") ?? "").trim();
    const robloxUser = String(form.get("robloxUser") ?? "").trim();
    const qty = Number(form.get("qty") ?? 0);
    if (!gakuranName) {
      toast.error("Enter a Gakuran name");
      return;
    }
    start(async () => {
      const res = await addReservation(guildId, {
        gakuranName,
        robloxUser,
        qty,
      });
      if (res.ok) {
        toast.success("Added");
        setAdding(false);
      } else {
        toast.error(res.error ?? "Couldn't add");
      }
    });
  };

  const bulkSend = async () => {
    if (snippetId === "") {
      toast.error("Pick a snippet");
      return;
    }
    const ids = [...selected];
    const withTicket = visible.filter(
      (r) => selected.has(r.id) && r.ticketId != null,
    ).length;
    if (withTicket === 0) {
      toast.error("None of the selected rows have a ticket");
      return;
    }
    const snippetName =
      snippets.find((s) => s.id === Number(snippetId))?.name ?? "this snippet";
    const ok = await confirm({
      title: "Send snippet?",
      message:
        `“${snippetName}” will be posted in ${withTicket} ticket channel${
          withTicket === 1 ? "" : "s"
        }, pinging each buyer` +
        (markDone ? ", and those rows will be marked done" : "") +
        ".",
      confirmLabel: "Send",
    });
    if (!ok) return;
    start(async () => {
      const res = await bulkSendSnippetToReservations(
        guildId,
        ids,
        Number(snippetId),
        markDone,
      );
      if (res.ok) {
        toast.success(
          `Queued for ${res.queued}${res.skipped ? ` · ${res.skipped} skipped` : ""}`,
        );
        if (markDone) {
          setLocal((s) => {
            const n = { ...s };
            for (const id of ids) n[id] = { ...n[id], status: "done" };
            return n;
          });
        }
        setSelected(new Set());
      } else {
        toast.error(res.error ?? "Couldn't send");
      }
    });
  };

  return (
    <div className={`space-y-3 ${pending ? "opacity-70" : ""}`}>
      {/* Budget banner */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-card border border-line bg-surface px-4 py-3">
        <label className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-faint">
            Available Robux
          </span>
          <input
            type="number"
            min={0}
            value={budgetDraft}
            onChange={(e) => setBudgetDraft(Number(e.target.value) || 0)}
            onBlur={(e) => saveBudget(Number(e.target.value) || 0)}
            className="input w-32 !py-1 text-lg font-bold"
          />
        </label>
        <div className="text-sm">
          <span className="text-faint">Committed </span>
          <span className="font-semibold">{nf.format(committed)}</span>
        </div>
        <div className="text-sm">
          <span className="text-faint">Remaining </span>
          <span
            className={`font-semibold ${remaining < 0 ? "text-danger" : "text-success"}`}
          >
            {nf.format(remaining)}
          </span>
        </div>
        <div className="grow" />
        <span className="text-xs text-faint">
          {rate.rerollUnit} rerolls = {nf.format(costOf(rate.rerollUnit))} Robux
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search name or Roblox user…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="grow" />
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setAdding((v) => !v)}
        >
          {adding ? "Cancel" : "Add walk-in"}
        </button>
      </div>

      {adding && (
        <form
          action={submitWalkIn}
          className="flex flex-wrap items-end gap-2 rounded-card border border-line bg-surface p-3"
        >
          <label className="text-xs text-dim">
            Gakuran name
            <input
              name="gakuranName"
              autoFocus
              className="input mt-1 block w-48"
            />
          </label>
          <label className="text-xs text-dim">
            Roblox user
            <input name="robloxUser" className="input mt-1 block w-48" />
          </label>
          <label className="text-xs text-dim">
            RR&apos;s
            <input
              name="qty"
              type="number"
              min={0}
              step={rate.rerollUnit}
              defaultValue={0}
              className="input mt-1 block w-24"
            />
          </label>
          <button type="submit" className="btn-primary" disabled={pending}>
            Add
          </button>
        </form>
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-accent/40 bg-[var(--accent-soft)] px-3 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <span className="text-dim">·</span>
          <select
            className="input !py-1"
            value={snippetId}
            onChange={(e) =>
              setSnippetId(e.target.value === "" ? "" : Number(e.target.value))
            }
          >
            <option value="">
              {snippets.length ? "Choose a snippet…" : "No snippets yet"}
            </option>
            {snippets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-dim">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-[var(--accent)]"
              checked={markDone}
              onChange={(e) => setMarkDone(e.target.checked)}
            />
            mark done after
          </label>
          <button
            type="button"
            className="btn-primary !py-1"
            disabled={pending || snippets.length === 0}
            onClick={() => void bulkSend()}
          >
            Send snippet
          </button>
          <button
            type="button"
            className="btn-ghost !py-1 text-xs"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          title={
            tab === "done"
              ? "Nothing fulfilled yet"
              : tab === "open"
                ? "Queue is clear"
                : "No reservations"
          }
          description={
            tab === "open"
              ? "Press 📌 Reserve in a ticket, or add a walk-in here."
              : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left text-xs uppercase tracking-wide text-faint">
                <th className="w-9 px-3 py-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--accent)]"
                    checked={allSelected}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? new Set(visibleIds) : new Set(),
                      )
                    }
                    title="Select all"
                  />
                </th>
                <th className="px-3 py-2">Gakuran Name</th>
                <th className="px-3 py-2">Roblox User</th>
                <th className="w-24 px-3 py-2">RR&apos;s</th>
                <th className="w-24 px-3 py-2 text-right">Robux</th>
                <th className="w-28 px-3 py-2">Paid</th>
                <th className="w-14 px-3 py-2">Done</th>
                <th className="w-24 px-3 py-2">From</th>
                <th className="w-10 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-line last:border-0 ${
                    selected.has(r.id)
                      ? "bg-[var(--accent-soft)]"
                      : "odd:bg-surface even:bg-surface-2/40"
                  }`}
                >
                  <td className="px-3 py-2 align-middle">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--accent)]"
                      checked={selected.has(r.id)}
                      onChange={(e) => toggleSel(r.id, e.target.checked)}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <input
                      className={`input w-full !py-1 ${r.status === "done" ? "text-faint line-through" : ""}`}
                      defaultValue={r.gakuranName || r.buyerName}
                      placeholder="—"
                      onBlur={(e) =>
                        saveField(r, "gakuranName", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <input
                      className="input w-full !py-1"
                      defaultValue={r.robloxUser}
                      placeholder="—"
                      onBlur={(e) => saveField(r, "robloxUser", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <input
                      type="number"
                      min={0}
                      step={rate.rerollUnit}
                      className="input w-20 !py-1"
                      defaultValue={r.qty}
                      onBlur={(e) => saveField(r, "qty", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2 text-right align-middle tabular-nums">
                    {nf.format(costOf(r.qty))}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => togglePaid(r, !r.paid)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        r.paid
                          ? "bg-success/15 text-success"
                          : "bg-danger/10 text-danger"
                      }`}
                    >
                      {r.paid ? "Paid" : "Not paid"}
                    </button>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--accent)]"
                      checked={r.status === "done"}
                      disabled={pending}
                      onChange={(e) => toggleDone(r, e.target.checked)}
                      title={
                        r.status === "done" ? "Mark not done" : "Mark done"
                      }
                    />
                  </td>
                  <td className="px-3 py-2 align-middle text-xs">
                    {r.ticketNumber != null ? (
                      r.channelId ? (
                        <a
                          className="text-accent hover:underline"
                          href={`https://discord.com/channels/${guildId}/${r.channelId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          #{r.ticketNumber}
                        </a>
                      ) : (
                        `#${r.ticketNumber}`
                      )
                    ) : (
                      <span
                        className="text-faint"
                        title={`Added ${fmtAgo(r.addedAt)}${r.addedByName ? ` by ${r.addedByName}` : ""}`}
                      >
                        walk-in
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right align-middle">
                    <button
                      type="button"
                      className="text-faint hover:text-danger"
                      title="Delete"
                      disabled={pending}
                      onClick={() => void remove(r)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
