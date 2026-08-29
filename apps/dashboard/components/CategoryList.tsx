"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { CategoryConfig } from "@ticketbot/shared";
import { reorderCategories } from "@/app/dashboard/[guildId]/actions";
import { useToast } from "./Toast";

export function CategoryList({
  guildId,
  initial,
}: {
  guildId: string;
  initial: CategoryConfig[];
}) {
  const [cats, setCats] = useState(initial);
  const [pending, start] = useTransition();
  const toast = useToast();

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= cats.length) return;
    const next = [...cats];
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    setCats(next);
    start(async () => {
      const res = await reorderCategories(
        guildId,
        next.map((c) => c.id),
      );
      if (res.ok) toast.success("Order saved");
      else toast.error("Couldn't save order");
    });
  };

  if (cats.length === 0) {
    return (
      <ul className="rounded-xl border border-line bg-surface">
        <li className="p-4 text-sm text-faint">No categories yet.</li>
      </ul>
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
          className="flex items-center gap-3 p-3.5 transition-colors hover:bg-surface-2"
        >
          <div className="flex flex-col leading-none">
            <button
              className="px-1 text-faint hover:text-white disabled:opacity-30"
              disabled={idx === 0 || pending}
              onClick={() => move(idx, -1)}
            >
              ▲
            </button>
            <button
              className="px-1 text-faint hover:text-white disabled:opacity-30"
              disabled={idx === cats.length - 1 || pending}
              onClick={() => move(idx, 1)}
            >
              ▼
            </button>
          </div>
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
