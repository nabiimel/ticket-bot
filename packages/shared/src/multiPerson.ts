export interface FormResponseLike {
  fieldKey: string;
  fieldLabel: string;
  value: string;
}

export interface MultiPersonEntry {
  index: number;
  name: string;
  robloxUser: string;
  qty: number;
}

const PERSON_KEY_RE = /^p(\d+)_/;

function pick(rows: FormResponseLike[], test: RegExp): string {
  return (
    rows
      .find((r) => test.test(r.fieldKey) || test.test(r.fieldLabel))
      ?.value?.trim() ?? ""
  );
}

/** First run of digits in a string, as a number (e.g. "50 rerolls" -> 50). */
function firstInt(s: string): number {
  const m = s.replace(/,/g, "").match(/\d+/);
  return m ? Math.min(parseInt(m[0], 10), 100000) : 0;
}

/**
 * Groups a ticket's "p<N>_"-prefixed form responses (from the multi-person
 * order flow) back into one entry per person, or returns null if this
 * ticket's form wasn't opened through that flow at all.
 */
export function groupMultiPersonResponses(
  responses: FormResponseLike[],
): MultiPersonEntry[] | null {
  const byIndex = new Map<number, FormResponseLike[]>();
  for (const r of responses) {
    const m = PERSON_KEY_RE.exec(r.fieldKey);
    if (!m) continue;
    const idx = Number(m[1]);
    if (!byIndex.has(idx)) byIndex.set(idx, []);
    byIndex.get(idx)!.push(r);
  }
  if (byIndex.size === 0) return null;

  return [...byIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, rows]) => ({
      index,
      name: pick(rows, /gakuran/i) || pick(rows, /\bign\b|in.?game.?name/i),
      robloxUser: pick(rows, /roblox/i),
      qty: firstInt(pick(rows, /re-?roll|\brr'?s?\b|how many/i)),
    }));
}
