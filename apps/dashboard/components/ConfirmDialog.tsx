"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const Ctx = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(
  null,
);

/** `const confirm = useConfirm(); if (await confirm({ title: … })) { … }` */
export function useConfirm() {
  const fn = useContext(Ctx);
  if (!fn) throw new Error("useConfirm() used outside <ConfirmProvider>");
  return fn;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [mounted, setMounted] = useState(false);
  const confirmBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => setMounted(true), []);

  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...o, resolve })),
    [],
  );

  const settle = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
    },
    [pending],
  );

  useEffect(() => {
    if (!pending) return;
    confirmBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") settle(false);
      if (e.key === "Enter") settle(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pending, settle]);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {mounted &&
        pending &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={pending.title}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
              onClick={() => settle(false)}
            />
            <div
              className="relative w-full max-w-sm rounded-xl border border-line bg-surface p-5 shadow-card"
              style={{ animation: "toast-in .16s ease-out" }}
            >
              <h2 className="text-base font-semibold">{pending.title}</h2>
              {pending.message && (
                <p className="mt-1.5 text-sm text-dim">{pending.message}</p>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => settle(false)}
                >
                  {pending.cancelLabel ?? "Cancel"}
                </button>
                <button
                  ref={confirmBtn}
                  type="button"
                  className={pending.danger ? "btn-danger" : "btn-primary"}
                  onClick={() => settle(true)}
                >
                  {pending.confirmLabel ?? "Confirm"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </Ctx.Provider>
  );
}
