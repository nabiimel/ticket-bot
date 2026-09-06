"use client";

import { useMemo, useState, useTransition } from "react";
import type { ReservationRecord, ReservationStatus } from "@ticketbot/shared";
import { fmtAgo } from "@/lib/format";
import {
  addReservation,
  bulkSendSnippetToReservations,
  deleteReservation,
  setReservationDone,
  updateReservation,
} from "@/app/dashboard/[guildId]/actions";
import { Relative } from "./Relative";
import { EmptyState } from "./EmptyState";
import { useToast } from "./Toast";

type Row = ReservationRecord & {
  buyerName: string;
  addedByName: string | null;
  doneByName: string | null;
  ticketNumber: number | null;
};

export function ReservationsTable({
  guildId,
  tab,
  rows,
  snippets,
}: {
  guildId: string;
  tab: ReservationStatus | "all";
  rows: Row[];
  snippets: { id: number; name: string }[];
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState("");
  // Local mirror so edits/toggles show instantly without a full refetch.
  const [local, setLocal] = useState<Record<number, Partial<Row>>>({});
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [snippetId, setSnippetId] = useState<number | "">("");
  const [markDone, setMarkDone] = useState(false);

  const merged = useMemo(
    () => rows.map((r) => ({ ...r, ...local[r.id] })),
    [rows, local],
  );

  const visible = merged.filter((r) => {
    if (removed.has(r.id)) return false;
    if (tab !== "all" && r.status !== tab) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !r.buyerName.toLowerCase().includes(q) &&
        !r.note.toLowerCase().includes(q)
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

  const toggleDone = (r: Row, done: boolean) => {
    patch(r.id, { status: done ? "done" : "open" });
    start(async () => {
      const res = await setReservationDone(guildId, r.id, done);
      if (!res.ok) {
        patch(r.id, { status: r.status });
        toast.error(res.error ?? "Couldn't update");
      } else {
        toast.success(done ? "Marked done" : "Reopened");
      }
    });
  };

  const saveField = (r: Row, field: "note" | "qty", value: string) => {
    const next =
      field === "qty"
        ? Math.min(Math.max(parseInt(value || "1", 10) || 1, 1), 9999)
        : value;
    if (r[field] === next) return;
    patch(r.id, { [field]: next } as Partial<Row>);
    start(async () => {
      const res = await updateReservation(guildId, r.id, { [field]: next });
      if (!res.ok) toast.error(res.error ?? "Couldn't save");
    });
  };

  const remove = (r: Row) => {
    if (!confirm(`Delete the reservation for ${r.buyerName}?`)) return;
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
    const buyerTag = String(form.get("buyerTag") ?? "").trim();
    const note = String(form.get("note") ?? "");
    const qty = Number(form.get("qty") ?? 1);
    if (!buyerTag) {
      toast.error("Enter a name");
      return;
    }
    start(async () => {
      const res = await addReservation(guildId, { buyerTag, note, qty });
      if (res.ok) {
        toast.success("Added");
        setAdding(false);
      } else {
        toast.error(res.error ?? "Couldn't add");
      }
    });
  };

  const bulkSend = () => {
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
    if (
      !confirm(
        `Send this snippet to ${withTicket} ticket channel(s)` +
          (markDone ? " and mark them done" : "") +
          "?",
      )
    )
      return;
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
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search buyer or note…"
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
            Buyer name
            <input
              name="buyerTag"
              autoFocus
              className="input mt-1 block w-48"
              placeholder="e.g. @someone / IGN"
            />
          </label>
          <label className="text-xs text-dim">
            Note
            <input
              name="note"
              className="input mt-1 block w-64"
              placeholder="What they ordered"
            />
          </label>
          <label className="text-xs text-dim">
            Qty
            <input
              name="qty"
              type="number"
              min={1}
              defaultValue={1}
              className="input mt-1 block w-20"
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
            onClick={bulkSend}
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
          <table className="w-full min-w-[780px] text-sm">
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
                <th className="w-10 px-3 py-2">Done</th>
                <th className="px-3 py-2">Buyer</th>
                <th className="px-3 py-2">Note</th>
                <th className="w-20 px-3 py-2">Qty</th>
                <th className="w-28 px-3 py-2">From</th>
                <th className="w-40 px-3 py-2">Added</th>
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
                  <td className="px-3 py-2 align-middle">
                    <span
                      className={
                        r.status === "done"
                          ? "text-faint line-through"
                          : "font-medium"
                      }
                    >
                      {r.buyerName}
                    </span>
                    {r.status === "done" && r.doneAt && (
                      <span className="ml-2 text-xs text-faint">
                        done {fmtAgo(r.doneAt)}
                        {r.doneByName ? ` by ${r.doneByName}` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <input
                      className="input w-full !py-1"
                      defaultValue={r.note}
                      placeholder="—"
                      onBlur={(e) => saveField(r, "note", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <input
                      type="number"
                      min={1}
                      className="input w-16 !py-1"
                      defaultValue={r.qty}
                      onBlur={(e) => saveField(r, "qty", e.target.value)}
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
                      <span className="text-faint">walk-in</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-middle text-xs text-faint">
                    <Relative
                      unix={r.addedAt}
                      ago
                      initial={fmtAgo(r.addedAt)}
                    />
                    {r.addedByName ? ` · ${r.addedByName}` : ""}
                  </td>
                  <td className="px-3 py-2 text-right align-middle">
                    <button
                      type="button"
                      className="text-faint hover:text-danger"
                      title="Delete"
                      disabled={pending}
                      onClick={() => remove(r)}
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
