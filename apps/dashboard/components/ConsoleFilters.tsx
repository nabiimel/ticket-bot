"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { TICKET_PRIORITIES } from "@ticketbot/shared";

const STATES = [
  ["all", "All"],
  ["unclaimed", "Unclaimed"],
  ["claimed", "Claimed"],
  ["flagged", "Flagged"],
] as const;

export function ConsoleFilters({
  categories,
}: {
  categories: { id: number; label: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const state = params.get("state") ?? "all";
  const cat = params.get("cat") ?? "";
  const priority = params.get("priority") ?? "";

  const go = (next: Record<string, string>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.push(`?${p.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-lg border border-line bg-surface p-1 text-sm">
        {STATES.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => go({ state: key === "all" ? "" : key })}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              state === key
                ? "bg-accent text-white"
                : "text-dim hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {categories.length > 0 && (
        <select
          className="input max-w-[12rem] text-sm"
          value={cat}
          onChange={(e) => go({ cat: e.target.value })}
        >
          <option value="">All types</option>
          {categories.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.label}
            </option>
          ))}
        </select>
      )}
      <select
        className="input max-w-[10rem] text-sm"
        value={priority}
        onChange={(e) => go({ priority: e.target.value })}
      >
        <option value="">Any priority</option>
        {TICKET_PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </div>
  );
}
