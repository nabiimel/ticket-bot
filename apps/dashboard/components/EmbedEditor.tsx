"use client";

import {
  PLACEHOLDERS,
  type EmbedConfig,
  type PlaceholderDoc,
} from "@ticketbot/shared";
import { ImageField } from "./ImageField";

type Props = {
  value: EmbedConfig;
  onChange: (next: EmbedConfig) => void;
  guildId: string;
  showPlaceholders?: boolean;
  /** Context-specific tokens shown above the standard list (e.g. this category's form fields). */
  extraPlaceholders?: PlaceholderDoc[];
};

export function EmbedEditor({
  value,
  onChange,
  guildId,
  showPlaceholders = true,
  extraPlaceholders = [],
}: Props) {
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
      </div>

      <div>
        <label className="label">Description</label>
        <textarea
          className="input min-h-[120px]"
          value={value.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
          maxLength={4096}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Color</label>
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
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={!!value.timestamp}
            onChange={(e) => set("timestamp", e.target.checked)}
          />
          Show timestamp
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ImageField
          label="Banner image"
          guildId={guildId}
          value={value.image}
          onChange={(next) => onChange({ ...value, image: next })}
        />
        <ImageField
          label="Thumbnail"
          guildId={guildId}
          value={value.thumbnail}
          onChange={(next) => onChange({ ...value, thumbnail: next })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Footer text</label>
          <input
            className="input"
            value={value.footer?.text ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                footer: e.target.value
                  ? { text: e.target.value, iconUrl: value.footer?.iconUrl }
                  : undefined,
              })
            }
          />
        </div>
        <div>
          <label className="label">Author name</label>
          <input
            className="input"
            value={value.author?.name ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                author: e.target.value
                  ? { name: e.target.value, iconUrl: value.author?.iconUrl }
                  : undefined,
              })
            }
          />
        </div>
      </div>

      {showPlaceholders && (
        <details className="rounded-md border border-line bg-surface p-3 text-sm">
          <summary className="cursor-pointer text-dim">
            Available placeholders
          </summary>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {[...extraPlaceholders, ...PLACEHOLDERS].map((p) => (
              <li key={p.token}>
                <code className="text-discord-blurple">{p.token}</code>{" "}
                <span className="text-faint">{p.description}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
