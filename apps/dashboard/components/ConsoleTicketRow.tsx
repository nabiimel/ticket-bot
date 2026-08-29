"use client";

import { useEffect, useState, useTransition } from "react";
import type { TicketRecord } from "@ticketbot/shared";
import { fmtDuration } from "@/lib/format";
import {
  claimTicketAdmin,
  closeTicketAdmin,
} from "@/app/dashboard/[guildId]/actions";
import { useToast } from "./Toast";
import { useConfirm } from "./ConfirmDialog";

const SLA_UNCLAIMED_S = 30 * 60;
const SLA_NO_REPLY_S = 60 * 60;

export function ConsoleTicketRow({
  t,
  category,
  opener,
  guildId,
  claiming,
  serverNow,
}: {
  t: TicketRecord;
  category: string;
  opener: string;
  guildId: string;
  claiming: boolean;
  serverNow: number;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [now, setNow] = useState(serverNow);
  const [claimed, setClaimed] = useState(!!t.claimedBy);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    setNow(Date.now() / 1000);
    const id = setInterval(() => setNow(Date.now() / 1000), 30_000);
    return () => clearInterval(id);
  }, []);

  if (gone) return null;

  const age = now - t.createdAt;
  const staleUnclaimed = claiming && !claimed && age > SLA_UNCLAIMED_S;
  const noReply = !t.firstStaffMsgAt && age > SLA_NO_REPLY_S;
  const flagged = staleUnclaimed || noReply;

  const claim = () =>
    start(async () => {
      const res = await claimTicketAdmin(guildId, t.id);
      if (res.ok) {
        setClaimed(true);
        toast.success(`Claimed #${t.number}`);
      } else toast.error(res.error ?? "Couldn't claim");
    });

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
      <td className="py-2 pr-3">
        #{t.number}
        {flagged && (
          <span
            className="ml-1.5 text-amber-400"
            title={
              staleUnclaimed
                ? "Unclaimed for over 30 min"
                : "No staff reply in over an hour"
            }
          >
            ▲
          </span>
        )}
      </td>
      <td className="py-2 pr-3 text-dim">{category}</td>
      <td className="max-w-[10rem] truncate py-2 pr-3 text-dim">{opener}</td>
      <td className="py-2 pr-3">
        {claiming ? (
          claimed ? (
            <span className="badge">claimed</span>
          ) : (
            <span className="badge badge-amber">unclaimed</span>
          )
        ) : t.firstStaffMsgAt ? (
          <span className="badge">in progress</span>
        ) : (
          <span className="badge badge-amber">awaiting reply</span>
        )}
      </td>
      <td className="py-2 pr-3 tabular-nums text-dim">{fmtDuration(age)}</td>
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
