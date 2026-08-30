"use client";

import type { FormState } from "@/lib/form";

export function FormBanner({ state }: { state: FormState }) {
  if (!state?.message) return null;
  return (
    <p
      className={`note text-sm ${state.ok ? "note-success" : "note-danger"}`}
      role="status"
    >
      {state.message}
    </p>
  );
}

export function FieldError({
  state,
  name,
}: {
  state: FormState;
  name: string;
}) {
  const msg = state?.fieldErrors?.[name];
  if (!msg) return null;
  return <p className="mt-1 text-xs text-danger">{msg}</p>;
}

export function hasError(state: FormState, name: string): boolean {
  return Boolean(state?.fieldErrors?.[name]);
}
