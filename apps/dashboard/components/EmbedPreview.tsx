"use client";

import { useEffect, useState } from "react";
import {
  PREVIEW_CONTEXT,
  hexToInt,
  renderEmbedConfig,
  type EmbedConfig,
} from "@ticketbot/shared";
import { renderMarkdown } from "@/lib/discord-markdown";

function intToHex(n: number) {
  return "#" + n.toString(16).padStart(6, "0");
}

/** A faithful-enough render of how the embed lands in a Discord channel. */
export function EmbedPreview({
  embed,
  extraContext,
}: {
  embed: EmbedConfig;
  extraContext?: Record<string, string>;
}) {
  const r = renderEmbedConfig(embed, { ...PREVIEW_CONTEXT, ...extraContext });
  const barColor = intToHex(hexToInt(r.color));

  // Client-only so the "Today at …" stamp doesn't cause a hydration mismatch.
  const [stamp, setStamp] = useState("Today");
  useEffect(() => {
    const now = new Date();
    setStamp(
      "Today at " +
        now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    );
  }, []);

  const empty = !r.title && !r.description && !r.image && !r.author?.name;

  return (
    <div
      className="rounded-lg bg-[#313338] p-4 font-sans text-[#dbdee1]"
      style={{ fontFamily: "'gg sans', ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="flex gap-4">
        <div className="h-10 w-10 shrink-0 rounded-full bg-discord-blurple" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[0.9375rem] font-medium text-white">
              Ticket Bot
            </span>
            <span className="rounded bg-discord-blurple px-1 py-px text-[0.625rem] font-semibold leading-none text-white">
              APP
            </span>
            <span
              className="text-[0.6875rem] text-[#949ba4]"
              suppressHydrationWarning
            >
              {stamp}
            </span>
          </div>

          <div
            className="max-w-[432px] rounded-[4px] bg-[#2b2d31]"
            style={{ borderLeft: `4px solid ${barColor}` }}
          >
            <div
              className={`grid gap-4 py-2 pl-3 pr-4 ${
                r.thumbnail ? "grid-cols-[1fr_80px]" : "grid-cols-1"
              }`}
            >
              <div className="min-w-0 space-y-2 pb-2 pt-0.5">
                {r.author?.name && (
                  <div className="flex items-center gap-2 text-[0.875rem] font-semibold text-white">
                    {r.author.iconUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.author.iconUrl}
                        alt=""
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    )}
                    <span className="truncate">{r.author.name}</span>
                  </div>
                )}

                {r.title && (
                  <div className="font-semibold leading-snug text-white">
                    {r.title}
                  </div>
                )}

                {r.description && (
                  <div className="text-[0.875rem] leading-[1.375] text-[#dbdee1]">
                    {renderMarkdown(r.description)}
                  </div>
                )}

                {r.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.image}
                    alt=""
                    className="mt-1 max-h-72 rounded-[4px] object-contain"
                  />
                )}

                {(r.footer?.text || r.timestamp) && (
                  <div className="flex items-center gap-2 pt-1 text-[0.75rem] text-[#949ba4]">
                    {r.footer?.iconUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.footer.iconUrl}
                        alt=""
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    )}
                    <span>
                      {r.footer?.text}
                      {r.footer?.text && r.timestamp ? " • " : ""}
                      {r.timestamp ? stamp : ""}
                    </span>
                  </div>
                )}

                {empty && (
                  <div className="text-[0.875rem] italic text-[#949ba4]">
                    Empty embed — add a title or description.
                  </div>
                )}
              </div>

              {r.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.thumbnail}
                  alt=""
                  className="mt-0.5 h-20 w-20 rounded-[4px] object-cover"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
