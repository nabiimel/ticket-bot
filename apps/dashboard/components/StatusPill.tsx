export type StatusKind =
  "claimed" | "unclaimed" | "in-progress" | "awaiting-reply" | "closed";

const META: Record<
  StatusKind,
  { label: string; variant: "" | "pill-warn" | "pill-success" | "pill-danger" }
> = {
  claimed: { label: "Claimed", variant: "pill-success" },
  unclaimed: { label: "Unclaimed", variant: "pill-warn" },
  "in-progress": { label: "In progress", variant: "" },
  "awaiting-reply": { label: "Awaiting reply", variant: "pill-warn" },
  closed: { label: "Closed", variant: "pill-danger" },
};

/** Map a ticket's live state to a status kind, matching the SLA/claim rules. */
export function ticketStatusKind(opts: {
  claiming: boolean;
  claimed: boolean;
  hasStaffReply: boolean;
}): StatusKind {
  if (opts.claiming) return opts.claimed ? "claimed" : "unclaimed";
  return opts.hasStaffReply ? "in-progress" : "awaiting-reply";
}

export function StatusPill({ kind }: { kind: StatusKind }) {
  const { label, variant } = META[kind];
  return (
    <span className={`pill ${variant}`}>
      <span className="pill-dot" />
      {label}
    </span>
  );
}
