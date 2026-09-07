/**
 * Reroll → Robux cost for the seller.
 *
 * `rerolls / unit` batches, each batch costs `robuxPerUnit`, then the seller's
 * Roblox Premium discount comes off. Default: 50 rerolls = 150 Robux − 20% =
 * 120 Robux. Computed live so changing the rate re-prices every row.
 */
export interface RobuxRate {
  /** Rerolls per pricing batch (default 50). */
  rerollUnit: number;
  /** List price in Robux for one batch (default 150). */
  robuxPerUnit: number;
  /** Premium discount, whole percent 0–100 (default 20). */
  discountPct: number;
}

export const DEFAULT_ROBUX_RATE: RobuxRate = {
  rerollUnit: 50,
  robuxPerUnit: 150,
  discountPct: 20,
};

export function robuxCost(rerolls: number, rate: RobuxRate): number {
  const unit = rate.rerollUnit > 0 ? rate.rerollUnit : 50;
  const n = Number.isFinite(rerolls) && rerolls > 0 ? rerolls : 0;
  const disc = Math.min(Math.max(rate.discountPct, 0), 100) / 100;
  return Math.round((n / unit) * rate.robuxPerUnit * (1 - disc));
}
