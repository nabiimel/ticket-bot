"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { CategoryConfig } from "@ticketbot/shared";
import { reorderCategories } from "@/app/dashboard/[guildId]/actions";
import { useToast } from "./Toast";
import { EmptyState } from "./EmptyState";

export function CategoryList({
  guildId,
  initial,
}: {
  guildId: string;
  initial: CategoryConfig[];
}) {
  const [cats, setCats] = useState(initial);
  const [pending, start] = useTransition();
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const overIdx = useRef<number | null>(null);
  const toast = useToast();

  const persist = (next: CategoryConfig[]) => {
    setCats(next);
    start(async () => {
      const res = await reorderCategories(
        guildId,
        next.map((c) => c.id),
      );
      if (res.ok) toast.success("Order saved");
      else {
        toast.error("Couldn't save order");
        setCats(initial);
      }
    });
  };

  const moveTo = (from: number, to: number) => {
    if (to < 0 || to >= cats.length || from === to) return;
    const next = [...cats];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row!);
    persist(next);
  };

  if (cats.length === 0) {
    return (
      <EmptyState
        title="No categories yet"
        description="A category is one type of ticket — Support, Rerolls, Report — each with its own staff, form and welcome message."
      />
    );
  }

  return (
    <ul
      className={`divide-row overflow-hidden rounded-xl border border-line bg-surface transition-opacity ${
        pending ? "opacity-60" : ""
      }`}
    >
      {cats.map((c, idx) => (
        <li
          key={c.id}
          draggable
          onDragStart={() => setDragIdx(idx)}
          onDragEnter={() => (overIdx.current = idx)}
          onDragOver={(e) => e.preventDefault()}
          onDragEnd={() => {
            if (dragIdx !== null && overIdx.current !== null)
              moveTo(dragIdx, overIdx.current);
            setDragIdx(null);
            overIdx.current = null;
          }}
          className={`flex items-center gap-3 p-3.5 transition-colors hover:bg-surface-2 ${
            dragIdx === idx ? "opacity-40" : ""
          }`}
        >
          <button
            type="button"
            aria-label={`Reorder ${c.label}. Use arrow keys.`}
            className="cursor-grab touch-none px-1 text-faint hover:text-ink active:cursor-grabbing"
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") {
                e.preventDefault();
                moveTo(idx, idx - 1);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                moveTo(idx, idx + 1);
              }
            }}
          >
            ⠿
          </button>
          <div className="grow">
            <div className="font-medium">
              {c.emoji ? `${c.emoji} ` : ""}
              {c.label} <span className="text-xs text-faint">({c.key})</span>
            </div>
            <div className="text-xs text-faint">
              {c.staffRoleIds.length} staff role(s) · {c.form.length} form
              field(s)
            </div>
          </div>
          <Link
            className="btn-secondary"
            href={`/dashboard/${guildId}/categories/${c.id}`}
          >
            Edit
          </Link>
        </li>
      ))}
    </ul>
  );
}
