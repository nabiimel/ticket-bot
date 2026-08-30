"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FeedNotification, NotificationType } from "@ticketbot/shared";
import { fmtAgo } from "@/lib/format";
import { markNotificationsRead } from "@/app/dashboard/[guildId]/actions";
import { Relative } from "./Relative";
import { EmptyState } from "./EmptyState";

const DOT: Record<string, string> = {
  critical: "bg-danger",
  warn: "bg-warn",
  info: "bg-accent",
};

const LABEL: Record<NotificationType, string> = {
  sla_unclaimed: "Unclaimed",
  sla_no_reply: "No reply",
  low_rating: "Low rating",
  job_failed: "System",
  config_changed: "Config",
  ticket_opened: "Opened",
  ticket_closed: "Closed",
};

type Filter = "all" | "attention" | "activity";

export function NotificationList({
  guildId,
  items,
}: {
  guildId: string;
  items: FeedNotification[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const marked = useRef(false);

  // Visiting the page counts as reading everything.
  useEffect(() => {
    if (marked.current) return;
    marked.current = true;
    void markNotificationsRead(guildId).then(() => router.refresh());
  }, [guildId, router]);

  const shown = items.filter((n) =>
    filter === "all"
      ? true
      : filter === "attention"
        ? n.severity !== "info"
        : n.severity === "info",
  );

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "attention", label: "Needs attention" },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg border border-line bg-surface p-1 text-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className={`rounded-md px-3 py-1 transition-colors ${
              filter === t.id
                ? "bg-surface-2 text-ink"
                : "text-dim hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title="Nothing here"
          description="Notifications about stale tickets, low ratings and config changes show up on this page."
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {shown.map((n) => {
            const inner = (
              <div className="flex items-start gap-3 px-4 py-3">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    DOT[n.severity] ?? "bg-faint"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-faint">
                      {LABEL[n.type]}
                    </span>
                    <span className="truncate text-sm text-ink">{n.title}</span>
                  </div>
                  {n.body && (
                    <p className="mt-0.5 truncate text-xs text-faint">
                      {n.body}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-faint">
                  <Relative unix={n.at} ago initial={fmtAgo(n.at)} />
                </span>
              </div>
            );
            return (
              <li key={n.key}>
                {n.href ? (
                  <Link href={n.href} className="block hover:bg-surface-2">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
