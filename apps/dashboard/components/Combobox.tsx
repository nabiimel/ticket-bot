"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type ComboOption = { id: string; name: string };

/**
 * Searchable single-select. Controlled via `value`/`onChange`. When `name` is
 * given it also renders a hidden input so it works inside a plain `<form>`.
 */
export function Combobox({
  options,
  value,
  onChange,
  name,
  placeholder = "— none —",
  allowClear = true,
  invalid = false,
}: {
  options: ComboOption[];
  value: string | null;
  onChange?: (id: string | null) => void;
  name?: string;
  placeholder?: string;
  allowClear?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? options.filter((o) => o.name.toLowerCase().includes(q))
      : options;
    return list.slice(0, 100);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (id: string | null) => {
    onChange?.(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className="relative">
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`input flex items-center justify-between text-left ${
          invalid ? "input-invalid" : ""
        }`}
      >
        <span className={selected ? "" : "text-faint"}>
          {selected ? selected.name : placeholder}
        </span>
        <span className="ml-2 text-faint">▾</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-field border border-line-strong bg-surface-2 shadow-pop">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-full border-b border-line bg-transparent px-3 py-2 text-sm outline-none"
          />
          <ul className="max-h-56 overflow-y-auto py-1 text-sm">
            {allowClear && (
              <li>
                <button
                  type="button"
                  onClick={() => pick(null)}
                  className="w-full px-3 py-1.5 text-left text-dim hover:bg-surface-2"
                >
                  {placeholder}
                </button>
              </li>
            )}
            {filtered.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => pick(o.id)}
                  className={`w-full px-3 py-1.5 text-left hover:bg-surface-2 ${
                    o.id === value ? "bg-discord-blurple/20" : ""
                  }`}
                >
                  {o.name}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-1.5 text-faint">No matches</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
