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

export interface RerollSplitEntry {
  name: string;
  count: number;
}

const SPLIT_ENTRY_RE = /^(.+?)\s*-\s*(\d+)\s*$/;

/**
 * Parses a "Name - count / Name - count" field into entries, or null if any
 * segment doesn't match that shape.
 */
export function parseRerollSplit(value: string): RerollSplitEntry[] | null {
  const parts = value
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const entries: RerollSplitEntry[] = [];
  for (const part of parts) {
    const m = SPLIT_ENTRY_RE.exec(part);
    if (!m) return null;
    entries.push({ name: m[1]!.trim(), count: parseInt(m[2]!, 10) });
  }
  return entries;
}

/**
 * Cross-field check for a "reroll-split" field: it must parse as "Name -
 * count" pairs, and those counts must not sum past `totalValue` (the
 * referenced field's raw answer). `totalLabel` is only used to phrase the
 * error message.
 */
export function validateRerollSplitSum(
  field: FormField,
  value: string,
  totalLabel: string,
  totalValue: string | undefined,
): string | null {
  if (!value) return null;
  const entries = parseRerollSplit(value);
  if (!entries) {
    return `${field.label} must list each person as "Name - count", separated by /.`;
  }
  const sum = entries.reduce((s, e) => s + e.count, 0);
  const total = Number(totalValue);
  if (totalValue && Number.isFinite(total) && sum > total) {
    return `${field.label} adds up to ${sum}, which is more than the ${total} from “${totalLabel}”.`;
  }
  return null;
}
