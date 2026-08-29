"use client";

import { useRef, useState } from "react";

export function ImageField({
  label,
  value,
  onChange,
  guildId,
}: {
  label: string;
  value?: string;
  onChange: (next: string | undefined) => void;
  guildId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/dashboard/${guildId}/uploads`, {
        method: "POST",
        body: fd,
      });
      const json = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !json.url) {
        setError(json.error ?? "Upload failed");
        return;
      }
      onChange(json.url);
    } catch {
      setError("Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input
          className="input"
          value={value ?? ""}
          placeholder="https://… or upload"
          onChange={(e) => onChange(e.target.value || undefined)}
        />
        <button
          type="button"
          className="btn-secondary shrink-0"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Uploading…" : "Upload"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void upload(f);
          }}
        />
      </div>
      {value && (
        <div className="mt-2 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="h-14 rounded border border-line-strong object-cover"
          />
          <button
            type="button"
            className="text-xs text-discord-red hover:underline"
            onClick={() => onChange(undefined)}
          >
            Remove
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-discord-red">{error}</p>}
    </div>
  );
}
