import type { FormField } from "./types.js";

const NUMERIC_RE = /^[0-9]+$/;

/** Validate one submitted answer against its field's rules. Error message, or null if OK. */
export function validateFormAnswer(
  field: FormField,
  value: string,
): string | null {
  if (!value) {
    return field.required ? `${field.label} is required.` : null;
  }
  if (field.validation === "numeric" && !NUMERIC_RE.test(value)) {
    return `${field.label} must contain numbers only.`;
  }
  return null;
}
