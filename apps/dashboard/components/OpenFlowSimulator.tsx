"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_WELCOME_EMBED,
  type ButtonConfig,
  type ButtonStyleName,
  type EmbedConfig,
  type FormField,
  type PanelStyle,
} from "@ticketbot/shared";
import { EmbedPreview } from "./EmbedPreview";
import { DiscordModal } from "./DiscordModal";

const BTN: Record<ButtonStyleName, string> = {
  Primary: "bg-[#5865f2] text-white",
  Secondary: "bg-[#4e5058] text-white",
  Success: "bg-[#248046] text-white",
  Danger: "bg-[#da373c] text-white",
};

export type SimCategory = {
  id: number;
  key: string;
  label: string;
  emoji: string | null;
  form: FormField[];
  welcomeEmbed: EmbedConfig | null;
};

/**
 * Walks the real open flow in the dashboard: the panel → the modal form (fill
 * it in) → what lands in the ticket channel. No test server, no throwaway
 * ticket.
 */
export function OpenFlowSimulator({
  embed,
  style,
  dropdownPlaceholder,
  buttons,
  categories,
}: {
  embed: EmbedConfig;
  style: PanelStyle;
  dropdownPlaceholder: string | null;
  buttons: Record<string, ButtonConfig>;
  categories: SimCategory[];
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"panel" | "modal" | "channel">("panel");
  const [cat, setCat] = useState<SimCategory | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errs, setErrs] = useState<Set<string>>(new Set());

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const reset = () => {
    setStep("panel");
    setCat(null);
    setAnswers({});
    setErrs(new Set());
  };

  const pick = (c: SimCategory) => {
    setCat(c);
    setAnswers({});
    setErrs(new Set());
    setStep(c.form.length > 0 ? "modal" : "channel");
  };

  const submit = () => {
    if (!cat) return;
    const missing = new Set(
      cat.form
        .filter((f) => f.required && !(answers[f.key] ?? "").trim())
        .map((f) => f.key),
    );
    setErrs(missing);
    if (missing.size === 0) setStep("channel");
  };

  const tokens = (): Record<string, string> => {
    if (!cat) return {};
    const t: Record<string, string> = {};
    for (const f of cat.form)
      t[`form.${f.key}`] = (answers[f.key] ?? "").trim() || "—";
    if (cat.form.length)
      t["form.all"] = cat.form
        .map((f) => `**${f.label}:** ${(answers[f.key] ?? "").trim() || "—"}`)
        .join("\n");
    return t;
  };

  return (
    <>
      <button
        type="button"
        className="btn-secondary w-full"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        ▶ Simulate the open flow
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <div
              className="my-8 w-full max-w-lg space-y-4 rounded-2xl border border-line bg-bg p-5 shadow-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  Open-flow preview
                  <span className="ml-2 text-xs font-normal text-faint">
                    {step === "panel"
                      ? "1 / 3 · the panel"
                      : step === "modal"
                        ? "2 / 3 · the form"
                        : "3 / 3 · the ticket channel"}
                  </span>
                </h3>
                <button
                  type="button"
                  className="btn-ghost !px-2 !py-1 text-sm"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>

              {step === "panel" && (
                <div className="space-y-3">
                  <p className="text-xs text-faint">
                    The message members see. Pick a ticket type.
                  </p>
                  <EmbedPreview embed={embed} />
                  {style === "dropdown" ? (
                    <div className="space-y-1">
                      <div className="rounded bg-[#1e1f22] px-3 py-2 text-sm text-[#949ba4]">
                        {dropdownPlaceholder || "Select a ticket type…"}
                      </div>
                      <div className="overflow-hidden rounded border border-line">
                        {categories.length === 0 && (
                          <div className="px-3 py-2 text-xs text-faint">
                            Add a ticket type to this panel first.
                          </div>
                        )}
                        {categories.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => pick(c)}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-2"
                          >
                            {c.emoji ? `${c.emoji} ` : ""}
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {categories.length === 0 && (
                        <span className="text-xs text-faint">
                          Add a ticket type to this panel first.
                        </span>
                      )}
                      {categories.map((c) => {
                        const b = buttons[c.id] ?? {
                          label: c.label,
                          style: "Primary" as ButtonStyleName,
                        };
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => pick(c)}
                            className={`rounded px-3 py-1.5 text-sm font-medium ${BTN[b.style]}`}
                          >
                            {(b.emoji || c.emoji) ?? ""} {b.label || c.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {step === "modal" && cat && (
                <DiscordModal
                  title={`Open ${cat.label}`.slice(0, 45)}
                  footer={
                    <>
                      <button
                        type="button"
                        className="rounded px-3 py-1.5 text-sm text-white/80 hover:underline"
                        onClick={() => setStep("panel")}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="rounded bg-[#5865f2] px-4 py-1.5 text-sm font-medium text-white"
                        onClick={submit}
                      >
                        Submit
                      </button>
                    </>
                  }
                >
                  {cat.form.map((f) => (
                    <label key={f.key} className="block">
                      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#b5bac1]">
                        {f.label}{" "}
                        {f.required && (
                          <span className="text-[#f23f42]">*</span>
                        )}
                        {errs.has(f.key) && (
                          <span className="ml-2 normal-case text-[#f23f42]">
                            — required
                          </span>
                        )}
                      </span>
                      {f.style === "paragraph" ? (
                        <textarea
                          rows={3}
                          maxLength={f.maxLength}
                          placeholder={f.placeholder}
                          className="w-full rounded bg-[#1e1f22] px-3 py-2 text-sm text-[#dbdee1] outline-none focus:ring-1 focus:ring-[#00a8fc]"
                          value={answers[f.key] ?? ""}
                          onChange={(e) =>
                            setAnswers((a) => ({
                              ...a,
                              [f.key]: e.target.value,
                            }))
                          }
                        />
                      ) : (
                        <input
                          maxLength={f.maxLength}
                          placeholder={f.placeholder}
                          className="w-full rounded bg-[#1e1f22] px-3 py-2 text-sm text-[#dbdee1] outline-none focus:ring-1 focus:ring-[#00a8fc]"
                          value={answers[f.key] ?? ""}
                          onChange={(e) =>
                            setAnswers((a) => ({
                              ...a,
                              [f.key]: e.target.value,
                            }))
                          }
                        />
                      )}
                    </label>
                  ))}
                </DiscordModal>
              )}

              {step === "channel" && cat && (
                <div className="space-y-3">
                  <p className="text-xs text-faint">
                    What appears in the new ticket channel.
                  </p>
                  <div className="rounded-lg bg-[#313338] p-3 text-sm">
                    <span className="rounded bg-[#3c4270] px-1 text-[#c9cdfb]">
                      @you
                    </span>{" "}
                    <span className="rounded bg-[#3c4270] px-1 text-[#c9cdfb]">
                      @staff
                    </span>
                  </div>
                  <EmbedPreview
                    embed={cat.welcomeEmbed ?? DEFAULT_WELCOME_EMBED}
                    extraContext={tokens()}
                  />
                  {cat.form.length > 0 && (
                    <div className="rounded-lg bg-[#313338] p-4">
                      <div className="max-w-md rounded border-l-4 border-[#5865f2] bg-[#2b2d31] p-3">
                        <div className="mb-2 font-semibold text-white">
                          Form responses
                        </div>
                        <div className="space-y-2">
                          {cat.form.map((f) => (
                            <div key={f.key}>
                              <div className="text-xs font-semibold text-white">
                                {f.label}
                              </div>
                              <div className="whitespace-pre-wrap text-sm text-[#dbdee1]">
                                {(answers[f.key] ?? "").trim() || "—"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className="rounded bg-[#5865f2] px-3 py-1.5 text-sm font-medium text-white">
                      🙋 Claim
                    </span>
                    <span className="rounded bg-[#da373c] px-3 py-1.5 text-sm font-medium text-white">
                      🔒 Close
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={reset}
                  >
                    Start over
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
