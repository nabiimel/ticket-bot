"use client";

import { useEffect, useRef } from "react";
import type { FormState } from "@/lib/form";
import { useToast } from "./Toast";

/** Fires a toast whenever a useFormState result carries a message. Renders nothing. */
export function FormToast({ state }: { state: FormState }) {
  const toast = useToast();
  const seen = useRef<FormState>(null);

  useEffect(() => {
    if (!state || state === seen.current) return;
    seen.current = state;
    if (state.message) {
      if (state.ok) toast.success(state.message);
      else toast.error(state.message);
    }
  }, [state, toast]);

  return null;
}
