"use client";

import { useRef } from "react";
import {
  PLACEHOLDERS,
  type EmbedConfig,
  type PlaceholderDoc,
} from "@ticketbot/shared";
import { ImageField } from "./ImageField";
import { insertAtCursor } from "@/lib/insert-at-cursor";

type Props = {
  value: EmbedConfig;
  onChange: (next: EmbedConfig) => void;
  guildId: string;
  showPlaceholders?: boolean;
  /** Context-specific tokens shown above the standard list (e.g. this category's form fields). */
  extraPlaceholders?: PlaceholderDoc[];
};

function Count({ n, max }: { n: number; max: number }) {
  const pct = n / max;
  return (
    <p
      className={`mt-1 text-right text-[11px] ${
        pct >= 1 ? "text-discord-red" : pct > 0.9 ? "text-warn" : "text-faint"
      }`}
    >
      {n}/{max}
    </p>
  );
}

export function EmbedEditor({
  value,
  onChange,
  guildId,
  showPlaceholders = true,
  extraPlaceholders = [],
}: Props) {
  const descRef = useRef<HTMLTextAreaElement>(null);
  const set = <K extends keyof EmbedConfig>(k: K, v: EmbedConfig[K]) =>
    onChange({ ...value, [k]: v || undefined });

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Title</label>
        <input
          className="input"
          value={value.title ?? ""}
          onChange={(e) => set("title", e.target.value)}
          maxLength={256}
        />
        <Count n={(value.title ?? "").length} max={256} />
      </div>

      <div>
        <label className="label">Description</label>
        <textarea
          ref={descRef}
          className="input min-h-[120px]"
          value={value.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
          maxLength={4096}
        />
        <Count n={(value.description ?? "").length} max={4096} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Accent colour</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="h-9 w-12 rounded border border-line-strong bg-surface-2"
              value={value.color ?? "#5865F2"}
              onChange={(e) => set("color", e.target.value)}
            />
            <input
              className="input"
              value={value.color ?? ""}
              placeholder="#5865F2"
              onChange={(e) => set("color", e.target.value)}
            />
          </div>
          <p className="mt-1 text-xs text-faint">
            The coloured bar down the left side.
          </p>
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={!!value.timestamp}
            onChange={(e) => set("timestamp", e.target.checked)}
          />
          Show the current time
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ImageField
          label="Large image (banner)"
          guildId={guildId}
          value={value.image}
          onChange={(next) => onChange({ ...value, image: next })}
        />
        <ImageField
          label="Small image (top-right)"
          guildId={guildId}
          value={value.thumbnail}
          onChange={(next) => onChange({ ...value, thumbnail: next })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Footer</label>
          <input
            className="input"
            value={value.footer?.text ?? ""}
            maxLength={2048}
            onChange={(e) =>
              onChange({
                ...value,
                footer: e.target.value
                  ? { text: e.target.value, iconUrl: value.footer?.iconUrl }
                  : undefined,
              })
            }
          />
          <p className="mt-1 text-xs text-faint">
            Small text along the bottom.
          </p>
        </div>
        <div>
          <label className="label">Small heading</label>
          <input
            className="input"
            value={value.author?.name ?? ""}
            maxLength={256}
            onChange={(e) =>
              onChange({
                ...value,
                author: e.target.value
                  ? { name: e.target.value, iconUrl: value.author?.iconUrl }
                  : undefined,
              })
            }
          />
          <p className="mt-1 text-xs text-faint">A line above the title.</p>
        </div>
      </div>

      {showPlaceholders && (
        <details className="rounded-md border border-line bg-surface p-3 text-sm">
          <summary className="cursor-pointer text-dim">
            Insert a placeholder
          </summary>
          <p className="mt-1 text-xs text-faint">
            Click one to drop it into the description at your cursor.
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {[...extraPlaceholders, ...PLACEHOLDERS].map((p) => (
              <li key={p.token}>
                <button
                  type="button"
                  className="text-discord-blurple hover:underline"
                  onClick={() =>
                    insertAtCursor(
                      descRef.current,
                      value.description ?? "",
                      p.token,
                      (v) => set("description", v),
                    )
                  }
                >
                  <code>{p.token}</code>
                </button>{" "}
                <span className="text-faint">{p.description}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
