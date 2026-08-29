"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Snippet } from "@ticketbot/shared";
import { deleteSnippet } from "@/app/dashboard/[guildId]/actions";
import { useToast } from "./Toast";
import { useConfirm } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";

export function SnippetList({
  guildId,
  initial,
}: {
  guildId: string;
  initial: Snippet[];
}) {
  const [snippets, setSnippets] = useState(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();

  const remove = async (id: number, name: string) => {
    const ok = await confirm({
      title: `Delete “${name}”?`,
      message: "This snippet will be removed permanently.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setSnippets((cur) => cur.filter((s) => s.id !== id));
    start(async () => {
      const res = await deleteSnippet(guildId, id);
      if (res.ok) toast.success(`Deleted “${name}”`);
      else {
        toast.error("Couldn't delete snippet");
        setSnippets(initial);
      }
    });
  };

  if (snippets.length === 0) {
    return (
      <EmptyState
        title="No snippets yet"
        description="Create a canned reply your staff can drop into a ticket with /snippet."
      />
    );
  }

  return (
    <ul
      className={`divide-row overflow-hidden rounded-xl border border-line bg-surface transition-opacity ${
        pending ? "opacity-60" : ""
      }`}
    >
      {snippets.map((s) => (
        <li
          key={s.id}
          className="flex items-center gap-3 p-3.5 transition-colors hover:bg-surface-2"
        >
          <div className="grow">
            <div className="font-medium">
              {s.name}
              {s.attachments.length > 0 && (
                <span className="ml-2 text-xs text-faint">
                  {s.attachments.length} image
                  {s.attachments.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div className="truncate text-xs text-faint">
              {s.content ? s.content.replace(/\s+/g, " ") : "No text"}
            </div>
          </div>
          <Link
            className="btn-secondary"
            href={`/dashboard/${guildId}/snippets/${s.id}`}
          >
            Edit
          </Link>
          <button
            type="button"
            className="text-xs text-discord-red hover:underline"
            disabled={pending}
            onClick={() => void remove(s.id, s.name)}
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
