"use client";

import { useMemo, useState } from "react";

export function MultiSelect({
  options,
  selected,
  onChange,
  emptyText = "Nothing available",
}: {
  options: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  emptyText?: string;
}) {
  const [query, setQuery] = useState("");
  const toggle = (id: string) =>
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? options.filter((o) => o.name.toLowerCase().includes(q))
      : options;
  }, [options, query]);

  return (
    <div className="rounded-md border border-line-strong bg-surface-2">
      {options.length > 6 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="w-full border-b border-line bg-transparent px-2 py-1.5 text-xs outline-none"
        />
      )}
      <div className="max-h-40 space-y-1 overflow-y-auto p-2">
        {options.length === 0 && (
          <div className="px-1 py-0.5 text-xs text-faint">{emptyText}</div>
        )}
        {filtered.map((o) => (
          <label
            key={o.id}
            className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-surface-2"
          >
            <input
              type="checkbox"
              checked={selected.includes(o.id)}
              onChange={() => toggle(o.id)}
            />
            {o.name}
          </label>
        ))}
        {filtered.length === 0 && options.length > 0 && (
          <div className="px-1 py-0.5 text-xs text-faint">No matches</div>
        )}
      </div>
    </div>
  );
}
