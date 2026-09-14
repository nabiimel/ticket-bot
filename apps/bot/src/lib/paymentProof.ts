/**
 * Ticket IDs with an unconfirmed "payment proof attached" prompt currently
 * posted in-channel, so a buyer sending several screenshots in a row before
 * staff gets to confirm doesn't spam the channel with repeat prompts.
 */
export const pendingPaymentProof = new Set<number>();
