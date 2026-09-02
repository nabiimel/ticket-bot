"use client";

import { useState, useTransition } from "react";
import type { ApplicationSubmission } from "@ticketbot/shared";
import { fmtAgo } from "@/lib/format";
import { decideSubmissionAction } from "@/app/dashboard/[guildId]/actions";
import { Relative } from "./Relative";
import { EmptyState } from "./EmptyState";
import { useToast } from "./Toast";

type Row = ApplicationSubmission & { appName: string; opener: string };

export function SubmissionsReview({
  guildId,
  rows,
}: {
  guildId: string;
  rows: Row[];
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [gone, setGone] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<number | null>(null);

  const decide = (id: number, decision: "approved" | "denied") => {
    const reason =
      decision === "denied"
        ? (window.prompt("Reason (optional, shared with the applicant):") ??
          undefined)
        : undefined;
    if (decision === "denied" && reason === undefined) return; // cancelled
    start(async () => {
      const res = await decideSubmissionAction(guildId, id, decision, reason);
      if (res.ok) {
        setGone((s) => new Set(s).add(id));
        toast.success(decision === "approved" ? "Approved" : "Denied");
      } else toast.error(res.error ?? "Couldn't decide");
    });
  };

  const visible = rows.filter((r) => !gone.has(r.id));
  if (visible.length === 0) {
    return (
      <EmptyState
        title="Nothing to review"
        description="No submissions here."
      />
    );
  }

  return (
    <ul
      className={`divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface ${
        pending ? "opacity-70" : ""
      }`}
    >
      {visible.map((r) => (
        <li key={r.id} className="p-3.5">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {r.appName}{" "}
                <span className="text-xs font-normal text-faint">
                  · {r.opener}
                </span>
              </div>
              <div className="text-xs text-faint">
                #{r.id} ·{" "}
                <Relative
                  unix={r.createdAt}
                  ago
                  initial={fmtAgo(r.createdAt)}
                />
                {r.status !== "pending" && ` · ${r.status}`}
              </div>
            </div>
            <button
              type="button"
              className="text-xs text-accent hover:underline"
              onClick={() => setExpanded(expanded === r.id ? null : r.id)}
            >
              {expanded === r.id ? "Hide" : "Answers"}
            </button>
            {r.status === "pending" && (
              <>
                <button
                  type="button"
                  className="btn-secondary !px-2 !py-1 text-xs"
                  disabled={pending}
                  onClick={() => decide(r.id, "approved")}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn-danger !px-2 !py-1 text-xs"
                  disabled={pending}
                  onClick={() => decide(r.id, "denied")}
                >
                  Deny
                </button>
              </>
            )}
          </div>
          {expanded === r.id && (
            <dl className="mt-2 space-y-2 rounded-md border border-line bg-surface-2 p-3 text-sm">
              {r.answers.map((a) => (
                <div key={a.key}>
                  <dt className="text-xs font-semibold text-dim">{a.label}</dt>
                  <dd className="whitespace-pre-wrap">{a.value || "—"}</dd>
                </div>
              ))}
              {r.reason && (
                <div>
                  <dt className="text-xs font-semibold text-dim">
                    Decision reason
                  </dt>
                  <dd>{r.reason}</dd>
                </div>
              )}
            </dl>
          )}
        </li>
      ))}
    </ul>
  );
}
