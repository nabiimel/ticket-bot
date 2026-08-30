"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FeedNotification } from "@ticketbot/shared";
import { fmtAgo } from "@/lib/format";
import { markNotificationsRead } from "@/app/dashboard/[guildId]/actions";
import { Icon } from "./icons";
import { Relative } from "./Relative";

const DOT: Record<string, string> = {
  critical: "bg-danger",
  warn: "bg-warn",
  info: "bg-accent",
};

export function NotificationBell({
  guildId,
  items,
  unread,
}: {
  guildId: string;
  items: FeedNotification[];
  unread: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Close on Esc / outside click.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  // Keep the feed fresh while the tab is visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60_000);
    return () => clearInterval(id);
  }, [router]);

  const markRead = () =>
    start(async () => {
      await markNotificationsRead(guildId);
      router.refresh();
    });

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn-ghost relative !px-2 !py-1.5"
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
        }
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="[&_svg]:h-[18px] [&_svg]:w-[18px]">{Icon.bell}</span>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            <button
              type="button"
              className="text-xs text-dim hover:text-ink disabled:opacity-50"
              disabled={pending || unread === 0}
              onClick={markRead}
            >
              Mark all read
            </button>
          </div>

          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-faint">
              Nothing to show yet.
            </p>
          ) : (
            <ul className="max-h-[22rem] divide-y divide-line overflow-y-auto">
              {items.slice(0, 12).map((n) => {
                const inner = (
                  <div className="flex items-start gap-2.5 px-3 py-2.5">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        DOT[n.severity] ?? "bg-faint"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{n.title}</p>
                      {n.body && (
                        <p className="truncate text-xs text-faint">{n.body}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] text-faint">
                      <Relative unix={n.at} ago initial={fmtAgo(n.at)} />
                    </span>
                  </div>
                );
                return (
                  <li key={n.key}>
                    {n.href ? (
                      <Link
                        href={n.href}
                        className="block hover:bg-surface-2"
                        onClick={() => setOpen(false)}
                      >
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

          <div className="border-t border-line px-3 py-2 text-center">
            <Link
              href={`/dashboard/${guildId}/notifications`}
              className="text-xs text-accent hover:underline"
              onClick={() => setOpen(false)}
            >
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
