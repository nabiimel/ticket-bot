"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PLACEHOLDERS, type Snippet } from "@ticketbot/shared";
import { saveSnippet, deleteSnippet } from "@/app/dashboard/[guildId]/actions";
import { useUnsavedChanges } from "@/lib/dirty-store";
import { insertAtCursor } from "@/lib/insert-at-cursor";
import { useToast } from "./Toast";
import { useConfirm } from "./ConfirmDialog";
import { StickySaveBar } from "./StickySaveBar";

const MAX_ATTACHMENTS = 5;

export function SnippetEditor({
  guildId,
  snippet,
}: {
  guildId: string;
  snippet: Snippet;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [name, setName] = useState(snippet.name);
  const [content, setContent] = useState(snippet.content);
  const [attachments, setAttachments] = useState<string[]>(snippet.attachments);

  const pristine =
    name === snippet.name &&
    content === snippet.content &&
    JSON.stringify(attachments) === JSON.stringify(snippet.attachments);
  useUnsavedChanges(!pristine);

  async function upload(file: File) {
    if (attachments.length >= MAX_ATTACHMENTS) return;
    setBusy(true);
    setUploadError(null);
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
        setUploadError(json.error ?? "Upload failed");
        return;
      }
      setAttachments((cur) =>
        cur.includes(json.url!) ? cur : [...cur, json.url!],
      );
    } catch {
      setUploadError("Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    start(async () => {
      const res = await saveSnippet(guildId, snippet.id, {
        name,
        content,
        attachments,
      });
      if (res.ok) {
        toast.success("Snippet saved");
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't save snippet");
      }
    });

  const discard = () => {
    setName(snippet.name);
    setContent(snippet.content);
    setAttachments(snippet.attachments);
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Delete “${snippet.name}”?`,
      message: "This snippet will be removed permanently.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    start(async () => {
      const res = await deleteSnippet(guildId, snippet.id);
      if (res.ok) {
        toast.success("Snippet deleted");
        router.push(`/dashboard/${guildId}/snippets`);
      } else {
        toast.error(res.error ?? "Couldn't delete snippet");
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="card space-y-4">
        <div>
          <label className="label">Shortcut</label>
          <input
            className="input max-w-xs"
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase())}
          />
          <p className="mt-1 text-xs text-faint">
            What staff type: <code>/snippet name:{name || "…"}</code>
          </p>
        </div>

        <div>
          <label className="label">Reply text</label>
          <textarea
            ref={contentRef}
            className="input min-h-[160px] font-mono text-sm"
            value={content}
            maxLength={2000}
            placeholder="Hi {user.mention}, thanks for reaching out…"
            onChange={(e) => setContent(e.target.value)}
          />
          <div
            className={`mt-1 text-right text-xs ${
              content.length >= 2000
                ? "text-discord-red"
                : content.length > 1800
                  ? "text-amber-400"
                  : "text-faint"
            }`}
          >
            {content.length}/2000
          </div>
          <details className="mt-2 rounded-md border border-line bg-surface p-3 text-sm">
            <summary className="cursor-pointer text-dim">
              Insert a placeholder
            </summary>
            <p className="mt-1 text-xs text-faint">
              Click one to drop it into the reply text at your cursor.
            </p>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {PLACEHOLDERS.map((p) => (
                <li key={p.token}>
                  <button
                    type="button"
                    className="text-discord-blurple hover:underline"
                    onClick={() =>
                      insertAtCursor(
                        contentRef.current,
                        content,
                        p.token,
                        setContent,
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
        </div>

        <div>
          <label className="label">
            Images ({attachments.length}/{MAX_ATTACHMENTS})
          </label>
          <div className="flex flex-wrap gap-3">
            {attachments.map((url) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="h-20 w-20 rounded border border-line-strong object-cover"
                />
                <button
                  type="button"
                  aria-label="Remove image"
                  className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-discord-red text-xs text-white"
                  onClick={() =>
                    setAttachments((cur) => cur.filter((u) => u !== url))
                  }
                >
                  ×
                </button>
              </div>
            ))}
            {attachments.length < MAX_ATTACHMENTS && (
              <button
                type="button"
                className="btn-secondary h-20 w-20 shrink-0 text-xs"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                {busy ? "Uploading…" : "+ Add"}
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void upload(f);
            }}
          />
          {uploadError && (
            <p className="mt-1 text-xs text-discord-red">{uploadError}</p>
          )}
          <p className="mt-1 text-xs text-faint">
            Sent as attachments below the message. PNG, JPG, GIF or WebP.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save snippet"}
        </button>
        <button
          className="text-sm text-discord-red hover:underline"
          onClick={() => void remove()}
          disabled={pending}
        >
          Delete
        </button>
      </div>

      <StickySaveBar
        dirty={!pristine}
        saving={pending}
        onSave={save}
        onDiscard={discard}
      />
    </div>
  );
}
