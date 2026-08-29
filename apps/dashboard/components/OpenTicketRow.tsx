"use client";

import { useEffect, useState } from "react";
import type { TicketRecord } from "@ticketbot/shared";
import { fmtDuration } from "@/lib/format";

const SLA_UNCLAIMED_S = 30 * 60;
const SLA_NO_REPLY_S = 60 * 60;

/**
 * One row of the Overview "Open tickets" table. The age counts up and the SLA
 * flag appears on its own as a ticket crosses a threshold — no refresh needed.
 * `serverNow` seeds the clock so first render matches the server.
 */
export function OpenTicketRow({
  t,
  category,
  guildId,
  claiming,
  serverNow,
}: {
  t: TicketRecord;
  category: string;
  guildId: string;
  claiming: boolean;
  serverNow: number;
}) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    setNow(Date.now() / 1000);
    const id = setInterval(() => setNow(Date.now() / 1000), 30_000);
    return () => clearInterval(id);
  }, []);

  const age = now - t.createdAt;
  const staleUnclaimed = claiming && !t.claimedBy && age > SLA_UNCLAIMED_S;
  const noReply = !t.firstStaffMsgAt && age > SLA_NO_REPLY_S;
  const flagged = staleUnclaimed || noReply;

  return (
    <tr>
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
      <td className="py-2 pr-3">
        {claiming ? (
          t.claimedBy ? (
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
        <a
          className="text-xs text-accent hover:underline"
          href={`https://discord.com/channels/${guildId}/${t.channelId}`}
          target="_blank"
          rel="noreferrer"
        >
          Jump →
        </a>
      </td>
    </tr>
  );
}
