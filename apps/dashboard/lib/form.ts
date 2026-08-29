/** Result of a form server action, consumed by `useFormState`. */
export type FormState = {
  ok: boolean;
  /** Shown as a green confirmation when ok, a red banner when not ok. */
  message?: string;
  /** Per-input errors, keyed by the input's `name`. */
  fieldErrors?: Record<string, string>;
} | null;

export const emptyFormState: FormState = null;

export function fieldError(state: FormState, name: string): string | undefined {
  return state?.fieldErrors?.[name];
}

export function err(fieldErrors: Record<string, string>): FormState {
  return {
    ok: false,
    message: "Please fix the highlighted fields.",
    fieldErrors,
  };
}

export function ok(message = "Saved"): FormState {
  return { ok: true, message };
}
