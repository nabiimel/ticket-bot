import {
  groupMultiPersonResponses,
  type FormResponseLike,
  type ReservationBreakdownEntry,
} from "@ticketbot/shared";

function pickFormValue(responses: FormResponseLike[], test: RegExp): string {
  const hit = responses.find(
    (r) => test.test(r.fieldKey) || test.test(r.fieldLabel),
  );
  return hit?.value?.trim() ?? "";
}

/** First run of digits in a string, as a number (e.g. "50 rerolls" -> 50). */
function firstInt(s: string): number {
  const m = s.replace(/,/g, "").match(/\d+/);
  return m ? Math.min(parseInt(m[0], 10), 100000) : 0;
}

export interface ExtractedReservationFields {
  gakuranName: string;
  robloxUser: string;
  qty: number;
  breakdown: ReservationBreakdownEntry[] | null;
}

/**
 * Pull Roblox username / Gakuran name / reroll count out of a ticket's form
 * answers — either one set of fields, or (a multi-person order) one set per
 * person. Shared by the manual Reserve button and ticket-creation auto-reserve
 * so both build a reservation the same way.
 */
export function extractReservationFields(
  responses: FormResponseLike[],
): ExtractedReservationFields {
  const multiPerson = groupMultiPersonResponses(responses);
  if (multiPerson) {
    const breakdown = multiPerson.map(({ name, robloxUser, qty }) => ({
      name,
      robloxUser,
      qty,
    }));
    const qty = breakdown.reduce((sum, p) => sum + p.qty, 0);
    const names = breakdown.map((p) => p.name || "?");
    const gakuranName =
      names.length > 3
        ? `${names.slice(0, 3).join(", ")} +${names.length - 3} more`
        : names.join(", ");
    return { gakuranName, robloxUser: "", qty, breakdown };
  }
  return {
    robloxUser: pickFormValue(responses, /roblox/i),
    gakuranName:
      pickFormValue(responses, /gakuran/i) ||
      pickFormValue(responses, /\bign\b|in.?game.?name/i),
    qty: firstInt(pickFormValue(responses, /re-?roll|\brr'?s?\b|how many/i)),
    breakdown: null,
  };
}
