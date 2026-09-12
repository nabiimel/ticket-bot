import type { DashboardPresenceEntry } from "@ticketbot/shared";

const MAX_SHOWN = 5;

/** Overlapping avatar stack for who else is currently on this dashboard. */
export function PresenceAvatars({
  entries,
}: {
  entries: DashboardPresenceEntry[];
}) {
  if (entries.length === 0) return null;
  const shown = entries.slice(0, MAX_SHOWN);
  const overflow = entries.length - shown.length;

  return (
    <div
      className="hidden -space-x-2 sm:flex"
      title={`${entries.length} other${entries.length === 1 ? "" : "s"} viewing this dashboard`}
    >
      {shown.map((p) => (
        <div
          key={p.userId}
          className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-3 text-[10px] font-bold text-dim ring-2 ring-[var(--bg-glass)]"
          title={p.name}
        >
          {p.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatarUrl} alt="" className="h-full w-full" />
          ) : (
            (p.name || "?").slice(0, 1).toUpperCase()
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-3 text-[10px] font-bold text-dim ring-2 ring-[var(--bg-glass)]">
          +{overflow}
        </div>
      )}
    </div>
  );
}
