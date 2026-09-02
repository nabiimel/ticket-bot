"use client";

import { useState } from "react";
import type { FormField } from "@ticketbot/shared";
import { DiscordModal } from "./DiscordModal";

const blank = (n: number): FormField => ({
  key: `field_${n}`,
  label: "New question",
  style: "short",
  required: false,
});

/**
 * The category "questions" editor rendered as the actual Discord modal members
 * fill in. Click a field in the mock to open its settings inline.
 */
export function FormFieldsBuilder({
  fields,
  onChange,
  categoryLabel,
}: {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
  categoryLabel: string;
}) {
  const [sel, setSel] = useState<number | null>(null);

  const set = (i: number, p: Partial<FormField>) =>
    onChange(fields.map((f, idx) => (idx === i ? { ...f, ...p } : f)));
  const remove = (i: number) => {
    onChange(fields.filter((_, idx) => idx !== i));
    setSel(null);
  };
  const add = () => {
    onChange([...fields, blank(fields.length + 1)]);
    setSel(fields.length);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
    setSel(j);
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">
          Questions before opening ({fields.length}/5)
        </h2>
        <button
          type="button"
          className="btn-secondary"
          onClick={add}
          disabled={fields.length >= 5}
        >
          Add question
        </button>
      </div>
      <p className="text-xs text-faint">
        This is the pop-up members fill in to open a ticket. Click a field to
        edit it.
      </p>

      <DiscordModal
        title={`Open ${categoryLabel || "ticket"}`.slice(0, 45)}
        footer={
          <span className="rounded bg-[#4e5058] px-4 py-1.5 text-sm font-medium text-white/80">
            Submit
          </span>
        }
      >
        {fields.length === 0 && (
          <p className="text-sm italic text-[#949ba4]">
            No questions — the ticket opens right away. Add one to collect info
            up front.
          </p>
        )}
        {fields.map((f, i) => (
          <div key={i}>
            <button
              type="button"
              onClick={() => setSel(sel === i ? null : i)}
              className={`w-full rounded p-1 text-left transition-colors ${
                sel === i
                  ? "bg-white/5 ring-1 ring-[#00a8fc]"
                  : "hover:bg-white/5"
              }`}
            >
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#b5bac1]">
                {f.label || "Untitled"}{" "}
                {f.required && <span className="text-[#f23f42]">*</span>}
              </div>
              <div
                className={`rounded bg-[#1e1f22] px-3 text-sm text-[#87898c] ${
                  f.style === "paragraph"
                    ? "flex min-h-[64px] items-start py-2"
                    : "flex h-9 items-center"
                }`}
              >
                {f.placeholder ||
                  (f.style === "paragraph"
                    ? "Longer answer…"
                    : "Short answer…")}
              </div>
            </button>

            {sel === i && (
              <div className="mt-2 space-y-3 rounded-lg border border-line bg-surface p-3 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="label">Question</span>
                    <input
                      className="input"
                      value={f.label}
                      onChange={(e) => set(i, { label: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="label">Answer id</span>
                    <input
                      className="input"
                      value={f.key}
                      onChange={(e) =>
                        set(i, {
                          key: e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9_]/g, ""),
                        })
                      }
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <select
                    className="input max-w-[12rem]"
                    value={f.style}
                    onChange={(e) =>
                      set(i, {
                        style: e.target.value as FormField["style"],
                      })
                    }
                  >
                    <option value="short">Short answer</option>
                    <option value="paragraph">Paragraph</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={(e) => set(i, { required: e.target.checked })}
                    />
                    Required
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <span className="label">Min length</span>
                    <input
                      type="number"
                      min={0}
                      max={4000}
                      className="input"
                      value={f.minLength ?? ""}
                      onChange={(e) =>
                        set(i, {
                          minLength: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="label">Max length</span>
                    <input
                      type="number"
                      min={1}
                      max={4000}
                      className="input"
                      value={f.maxLength ?? ""}
                      onChange={(e) =>
                        set(i, {
                          maxLength: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="label">Placeholder</span>
                    <input
                      className="input"
                      value={f.placeholder ?? ""}
                      onChange={(e) =>
                        set(i, { placeholder: e.target.value || undefined })
                      }
                    />
                  </label>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    className="btn-secondary !px-2 !py-1 text-xs"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn-secondary !px-2 !py-1 text-xs"
                    disabled={i === fields.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="ml-auto text-xs text-danger hover:underline"
                    onClick={() => remove(i)}
                  >
                    Remove question
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </DiscordModal>

      {fields.length > 0 && (
        <p className="text-xs text-faint">
          Reference an answer in the welcome message as{" "}
          <code className="text-discord-blurple">{`{form.${
            fields[0]?.key || "answer_id"
          }}`}</code>
          , or drop them all in with{" "}
          <code className="text-discord-blurple">{"{form.all}"}</code>.
        </p>
      )}
    </div>
  );
}
