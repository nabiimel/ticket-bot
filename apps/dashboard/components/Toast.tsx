"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";

type Kind = "success" | "error" | "info";
type ToastItem = { id: number; kind: Kind; message: string };

const ToastCtx = createContext<{
  push: (kind: Kind, message: string) => void;
} | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast() used outside <ToastProvider>");
  return useMemo(
    () => ({
      success: (m: string) => ctx.push("success", m),
      error: (m: string) => ctx.push("error", m),
      info: (m: string) => ctx.push("info", m),
    }),
    [ctx],
  );
}

const ICON: Record<Kind, string> = { success: "✓", error: "!", info: "i" };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const push = useCallback((kind: Kind, message: string) => {
    const id = Date.now() + Math.random();
    setItems((cur) => [...cur, { id, kind, message }]);
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 3800);
  }, []);

  const dismiss = (id: number) =>
    setItems((cur) => cur.filter((t) => t.id !== id));

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end">
            {items.map((t) => (
              <div
                key={t.id}
                role="status"
                style={{ animation: "toast-in .18s ease-out" }}
                className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-card backdrop-blur ${
                  t.kind === "success"
                    ? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success-text)]"
                    : t.kind === "error"
                      ? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger-text)]"
                      : "border-line bg-surface text-ink"
                }`}
              >
                <span className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full bg-current/20 text-[10px] font-bold">
                  {ICON[t.kind]}
                </span>
                <span className="flex-1 leading-snug">{t.message}</span>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  className="text-current/50 transition-colors hover:text-current"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastCtx.Provider>
  );
}
