"use client";

import { useEffect, useState, useTransition } from "react";
import { TICKET_PRIORITIES, type TicketRecord } from "@ticketbot/shared";
import { fmtDuration } from "@/lib/format";
import {
  claimTicketAdmin,
  closeTicketAdmin,
  setTicketPriority,
} from "@/app/dashboard/[guildId]/actions";
import { useToast } from "./Toast";
import { useConfirm } from "./ConfirmDialog";
import { StatusPill, ticketStatusKind } from "./StatusPill";
import { TagChips } from "./TicketMeta";

export function ConsoleTicketRow({
  t,
  category,
  opener,
  guildId,
  claiming,
  serverNow,
  slaUnclaimedS,
  slaNoReplyS,
}: {
  t: TicketRecord;
  category: string;
  opener: string;
  guildId: string;
  claiming: boolean;
  serverNow: number;
  slaUnclaimedS: number;
  slaNoReplyS: number;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [now, setNow] = useState(serverNow);
  const [claimed, setClaimed] = useState(!!t.claimedBy);
  const [priority, setPriority] = useState(t.priority);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    setNow(Date.now() / 1000);
    const id = setInterval(() => setNow(Date.now() / 1000), 30_000);
    return () => clearInterval(id);
  }, []);

  if (gone) return null;

  const age = now - t.createdAt;
  const staleUnclaimed = claiming && !claimed && age > slaUnclaimedS;
  const noReply = !t.firstStaffMsgAt && age > slaNoReplyS;
  const flagged = staleUnclaimed || noReply;

  const claim = () =>
    start(async () => {
      const res = await claimTicketAdmin(guildId, t.id);
      if (res.ok) {
        setClaimed(true);
        toast.success(`Claimed #${t.number}`);
      } else toast.error(res.error ?? "Couldn't claim");
    });

  const changePriority = (next: string) => {
    const prev = priority;
    setPriority(next as typeof priority);
    start(async () => {
      const res = await setTicketPriority(guildId, t.id, next);
      if (res.ok) toast.success(`#${t.number} → ${next}`);
      else {
        setPriority(prev);
        toast.error(res.error ?? "Couldn't set priority");
      }
    });
  };

  const close = async () => {
    const ok = await confirm({
      title: `Close ticket #${t.number}?`,
      message:
        "The channel is closed and a transcript is generated, same as the in-Discord Close button.",
      confirmLabel: "Close ticket",
      danger: true,
    });
    if (!ok) return;
    start(async () => {
      const res = await closeTicketAdmin(guildId, t.id);
      if (res.ok) {
        setGone(true);
        toast.success(`Closing #${t.number}…`);
      } else toast.error(res.error ?? "Couldn't close");
    });
  };

  return (
    <tr className={pending ? "opacity-50" : ""}>
      <td className="py-2 pr-3 font-medium tabular-nums">
        #{t.number}
        {flagged && (
          <span
            className="ml-1.5 text-warn"
            title={
              staleUnclaimed
                ? "Unclaimed past target"
                : "No staff reply past target"
            }
          >
            ▲
          </span>
        )}
      </td>
      <td className="py-2 pr-3 text-dim">
        <div className="flex flex-col gap-1">
          <span>{category}</span>
          <TagChips tags={t.tags} />
        </div>
      </td>
      <td className="max-w-[10rem] truncate py-2 pr-3 text-dim">{opener}</td>
      <td className="py-2 pr-3">
        <select
          value={priority}
          disabled={pending}
          onChange={(e) => changePriority(e.target.value)}
          className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-xs"
          aria-label={`Priority for ticket #${t.number}`}
        >
          {TICKET_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-3">
        <StatusPill
          kind={ticketStatusKind({
            claiming,
            claimed,
            hasStaffReply: !!t.firstStaffMsgAt,
          })}
        />
      </td>
      <td
        className="py-2 pr-3 text-right tabular-nums text-dim"
        title={new Date(t.createdAt * 1000).toLocaleString()}
        suppressHydrationWarning
      >
        {fmtDuration(age)}
      </td>
      <td className="py-2">
        <div className="flex items-center justify-end gap-2">
          <a
            className="text-xs text-accent hover:underline"
            href={`https://discord.com/channels/${guildId}/${t.channelId}`}
            target="_blank"
            rel="noreferrer"
          >
            Jump
          </a>
          {claiming && !claimed && (
            <button
              type="button"
              className="btn-secondary !px-2 !py-1 text-xs"
              disabled={pending}
              onClick={claim}
            >
              Claim
            </button>
          )}
          <button
            type="button"
            className="btn-danger !px-2 !py-1 text-xs"
            disabled={pending}
            onClick={() => void close()}
          >
            Close
          </button>
        </div>
      </td>
    </tr>
  );
}
