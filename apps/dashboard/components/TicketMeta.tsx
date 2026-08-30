import type { TicketPriority } from "@ticketbot/shared";

const PRIO: Record<TicketPriority, { label: string; cls: string } | null> = {
  urgent: { label: "Urgent", cls: "pill-danger" },
  high: { label: "High", cls: "pill-warn" },
  normal: null,
  low: { label: "Low", cls: "" },
};

/** Small pill for a ticket's priority. Renders nothing for "normal". */
export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const p = PRIO[priority];
  if (!p) return null;
  return (
    <span className={`pill ${p.cls}`}>
      <span className="pill-dot" />
      {p.label}
    </span>
  );
}

export function TagChips({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-dim"
        >
          {tag}
        </span>
      ))}
    </span>
  );
}
