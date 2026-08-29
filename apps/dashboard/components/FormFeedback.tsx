"use client";

import type { FormState } from "@/lib/form";

export function FormBanner({ state }: { state: FormState }) {
  if (!state?.message) return null;
  return (
    <p
      className={`rounded-md px-4 py-2 text-sm ${
        state.ok
          ? "bg-discord-green/15 text-emerald-300"
          : "bg-discord-red/15 text-red-300"
      }`}
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
  return <p className="mt-1 text-xs text-red-400">{msg}</p>;
}

export function hasError(state: FormState, name: string): boolean {
  return Boolean(state?.fieldErrors?.[name]);
}
