"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  publishPanel,
  setPanelCategorySet,
} from "@/app/dashboard/[guildId]/actions";
import { useToast } from "./Toast";

type Cat = { id: number; label: string; emoji: string | null };
type Panel = {
  id: number;
  title: string;
  channelId: string | null;
  channelName: string | null;
  status: "draft" | "published";
  categoryIds: number[];
};

type DragState = { catId: number; from: "pool" | number } | null;

export function PanelsBoard({
  guildId,
  categories,
  panels,
}: {
  guildId: string;
  categories: Cat[];
  panels: Panel[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const drag = useRef<DragState>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);

  // panelId -> ordered categoryIds (the editable state)
  const [assign, setAssign] = useState<Record<number, number[]>>(() =>
    Object.fromEntries(panels.map((p) => [p.id, [...p.categoryIds]])),
  );
  const [status, setStatus] = useState<Record<number, "draft" | "published">>(
    () => Object.fromEntries(panels.map((p) => [p.id, p.status])),
  );

  const catById = (id: number) => categories.find((c) => c.id === id);
  const panelsWith = (catId: number) =>
    panels.filter((p) => (assign[p.id] ?? []).includes(catId));

  const persist = (panelId: number, next: number[]) => {
    const prev = assign[panelId] ?? [];
    setAssign((a) => ({ ...a, [panelId]: next }));
    start(async () => {
      const res = await setPanelCategorySet(guildId, panelId, next);
      if (res.ok) {
        router.refresh();
      } else {
        setAssign((a) => ({ ...a, [panelId]: prev }));
        toast.error(res.error ?? "Couldn't update the panel");
      }
    });
  };

  const dropOnColumn = (panelId: number) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const cur = assign[panelId] ?? [];
    if (cur.includes(d.catId)) return;
    persist(panelId, [...cur, d.catId]);
  };

  const dropOnCard = (panelId: number, index: number) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const cur = assign[panelId] ?? [];
    if (d.from === panelId) {
      const from = cur.indexOf(d.catId);
      if (from < 0 || from === index) return;
      const next = [...cur];
      next.splice(from, 1);
      next.splice(index, 0, d.catId);
      persist(panelId, next);
    } else {
      if (cur.includes(d.catId)) return;
      const next = [...cur];
      next.splice(index, 0, d.catId);
      persist(panelId, next);
    }
  };

  const move = (panelId: number, catId: number, dir: -1 | 1) => {
    const cur = assign[panelId] ?? [];
    const i = cur.indexOf(catId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= cur.length) return;
    const next = [...cur];
    [next[i], next[j]] = [next[j]!, next[i]!];
    persist(panelId, next);
  };

  const remove = (panelId: number, catId: number) =>
    persist(
      panelId,
      (assign[panelId] ?? []).filter((x) => x !== catId),
    );

  const publish = (panelId: number) => {
    const prev = status[panelId];
    setStatus((s) => ({ ...s, [panelId]: "published" }));
    start(async () => {
      const res = await publishPanel(guildId, panelId);
      if (res.ok) {
        toast.success("Panel published — posting to Discord");
        router.refresh();
      } else {
        setStatus((s) => ({ ...s, [panelId]: prev }));
        toast.error(res.error ?? "Couldn't publish");
      }
    });
  };

  const catFace = (c: Cat) => `${c.emoji ? `${c.emoji} ` : ""}${c.label}`;

  return (
    <div
      className={`flex gap-4 overflow-x-auto pb-2 ${pending ? "opacity-70" : ""}`}
    >
      {/* Pool */}
      <div className="w-60 shrink-0 rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-3 py-2 text-sm font-semibold">
          All ticket types{" "}
          <span className="text-xs font-normal text-faint">
            {categories.length}
          </span>
        </div>
        <ul className="space-y-1.5 p-2">
          {categories.length === 0 && (
            <li className="px-1 py-2 text-xs text-faint">
              No categories yet — create one on the Categories page.
            </li>
          )}
          {categories.map((c) => {
            const on = panelsWith(c.id);
            return (
              <li
                key={c.id}
                draggable
                onDragStart={() =>
                  (drag.current = { catId: c.id, from: "pool" })
                }
                className="group relative flex items-center gap-2 rounded-md border border-line bg-surface-2 px-2 py-1.5 text-sm"
              >
                <span className="cursor-grab text-faint active:cursor-grabbing">
                  ⠿
                </span>
                <span className="min-w-0 flex-1 truncate">{catFace(c)}</span>
                {on.length > 0 && (
                  <span
                    className="text-[10px] text-faint"
                    title={on.map((p) => p.title).join(", ")}
                  >
                    on {on.length}
                  </span>
                )}
                <button
                  type="button"
                  className="text-faint hover:text-ink"
                  aria-label={`Add ${c.label} to a panel`}
                  onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}
                >
                  ＋
                </button>
                {menuFor === c.id && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-line bg-surface shadow-card">
                    {panels.filter((p) => !(assign[p.id] ?? []).includes(c.id))
                      .length === 0 ? (
                      <div className="px-3 py-2 text-xs text-faint">
                        On every panel already.
                      </div>
                    ) : (
                      panels
                        .filter((p) => !(assign[p.id] ?? []).includes(c.id))
                        .map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="block w-full px-3 py-1.5 text-left text-xs hover:bg-surface-2"
                            onClick={() => {
                              setMenuFor(null);
                              persist(p.id, [...(assign[p.id] ?? []), c.id]);
                            }}
                          >
                            Add to {p.title}
                          </button>
                        ))
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Panels */}
      {panels.map((p) => {
        const ids = assign[p.id] ?? [];
        return (
          <div
            key={p.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => dropOnColumn(p.id)}
            className="flex w-64 shrink-0 flex-col rounded-xl border border-line bg-surface"
          >
            <div className="border-b border-line px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {p.title}
                </span>
                <span
                  className={
                    status[p.id] === "published"
                      ? "badge badge-green"
                      : "badge badge-amber"
                  }
                >
                  {status[p.id]}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-faint">
                <span>
                  {p.channelName ? `#${p.channelName}` : "no channel"}
                </span>
                <span>·</span>
                <Link
                  href={`/dashboard/${guildId}/panels/${p.id}`}
                  className="text-accent hover:underline"
                >
                  Open editor
                </Link>
                <button
                  type="button"
                  className="btn-secondary ml-auto !px-2 !py-0.5 text-[11px]"
                  disabled={pending || !p.channelId}
                  title={
                    p.channelId
                      ? undefined
                      : "Set a target channel in the editor first"
                  }
                  onClick={() => publish(p.id)}
                >
                  {status[p.id] === "published" ? "Re-post" : "Publish"}
                </button>
              </div>
            </div>

            <ul className="min-h-[3rem] flex-1 space-y-1.5 p-2">
              {ids.length === 0 && (
                <li className="rounded-md border border-dashed border-line-strong px-2 py-4 text-center text-xs text-faint">
                  Drag ticket types here
                </li>
              )}
              {ids.map((cid, idx) => {
                const c = catById(cid);
                return (
                  <li
                    key={cid}
                    draggable
                    onDragStart={() =>
                      (drag.current = { catId: cid, from: p.id })
                    }
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.stopPropagation();
                      dropOnCard(p.id, idx);
                    }}
                    className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-2 py-1.5 text-sm"
                  >
                    <button
                      type="button"
                      aria-label={`Reorder ${c?.label ?? cid}. Use arrow keys.`}
                      className="cursor-grab text-faint hover:text-ink active:cursor-grabbing"
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          move(p.id, cid, -1);
                        } else if (e.key === "ArrowDown") {
                          e.preventDefault();
                          move(p.id, cid, 1);
                        }
                      }}
                    >
                      ⠿
                    </button>
                    <span className="min-w-0 flex-1 truncate">
                      {c ? catFace(c) : `#${cid}`}
                    </span>
                    <button
                      type="button"
                      className="text-faint hover:text-danger"
                      aria-label={`Remove ${c?.label ?? cid} from ${p.title}`}
                      onClick={() => remove(p.id, cid)}
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
