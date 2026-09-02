import type { ReactNode } from "react";

/** Discord-style modal chrome. Used by the form builder and the flow simulator. */
export function DiscordModal({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      className="w-full max-w-md rounded-lg bg-[#313338] p-4 shadow-xl"
      style={{
        fontFamily: "'gg sans', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div className="mb-3 text-[15px] font-semibold text-white">{title}</div>
      <div className="space-y-3">{children}</div>
      {footer !== undefined && (
        <div className="mt-4 flex items-center justify-end gap-2">{footer}</div>
      )}
    </div>
  );
}
