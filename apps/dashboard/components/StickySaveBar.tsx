"use client";

import { useEffect } from "react";

/**
 * Bottom bar that appears while an editor has unsaved changes. Also wires
 * Cmd/Ctrl+S to save. Render it as the last child of the editor.
 */
export function StickySaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  label = "Unsaved changes",
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard?: () => void;
  label?: string;
}) {
  useEffect(() => {
    if (!dirty) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving) onSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, saving, onSave]);

  if (!dirty) return null;

  return (
    <div className="sticky bottom-4 z-30 mt-6 flex items-center justify-between gap-3 rounded-xl border border-line-strong bg-[var(--bg-glass)] px-4 py-3 shadow-card backdrop-blur">
      <span className="text-sm text-dim">{label}</span>
      <div className="flex items-center gap-2">
        {onDiscard && (
          <button
            type="button"
            className="btn-ghost text-sm"
            onClick={onDiscard}
            disabled={saving}
          >
            Discard
          </button>
        )}
        <button
          type="button"
          className="btn-primary"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
