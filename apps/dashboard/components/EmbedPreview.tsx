"use client";

import {
  PREVIEW_CONTEXT,
  hexToInt,
  renderEmbedConfig,
  type EmbedConfig,
} from "@ticketbot/shared";

function intToHex(n: number) {
  return "#" + n.toString(16).padStart(6, "0");
}

export function EmbedPreview({
  embed,
  extraContext,
}: {
  embed: EmbedConfig;
  extraContext?: Record<string, string>;
}) {
  const r = renderEmbedConfig(embed, { ...PREVIEW_CONTEXT, ...extraContext });
  const barColor = intToHex(hexToInt(r.color));

  return (
    <div className="rounded-lg bg-[#313338] p-4">
      <div className="flex gap-3">
        <div className="h-10 w-10 shrink-0 rounded-full bg-discord-blurple" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-baseline gap-2">
            <span className="text-sm font-medium text-white">Ticket Bot</span>
            <span className="rounded bg-discord-blurple px-1 text-[10px] font-bold text-white">
              APP
            </span>
            <span className="text-xs text-faint">Today</span>
          </div>

          <div
            className="max-w-md overflow-hidden rounded border-l-4 bg-[#2b2d31]"
            style={{ borderColor: barColor }}
          >
            <div className="space-y-2 p-3">
              {r.author?.name && (
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  {r.author.iconUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.author.iconUrl}
                      alt=""
                      className="h-5 w-5 rounded-full"
                    />
                  )}
                  {r.author.name}
                </div>
              )}
              {r.title && (
                <div className="font-semibold text-white">{r.title}</div>
              )}
              {r.description && (
                <div className="whitespace-pre-wrap text-sm text-[#dbdee1]">
                  {r.description}
                </div>
              )}
              {r.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.thumbnail}
                  alt=""
                  className="ml-auto max-h-20 rounded"
                />
              )}
              {r.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.image}
                  alt=""
                  className="max-h-52 w-full rounded object-cover"
                />
              )}
              {(r.footer?.text || r.timestamp) && (
                <div className="flex items-center gap-2 pt-1 text-[11px] text-dim">
                  {r.footer?.iconUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.footer.iconUrl}
                      alt=""
                      className="h-4 w-4 rounded-full"
                    />
                  )}
                  <span>
                    {r.footer?.text}
                    {r.footer?.text && r.timestamp ? " • " : ""}
                    {r.timestamp ? "Today at 12:00 PM" : ""}
                  </span>
                </div>
              )}
              {!r.title && !r.description && !r.image && (
                <div className="text-sm italic text-faint">
                  Empty embed — add a title or description.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
