import { describe, expect, it } from "vitest";
import { DEFAULT_ROBUX_RATE, robuxCost } from "./reservations.js";

describe("robuxCost", () => {
  it("prices the default rate (50 = 150 − 20% = 120)", () => {
    expect(robuxCost(50, DEFAULT_ROBUX_RATE)).toBe(120);
    expect(robuxCost(100, DEFAULT_ROBUX_RATE)).toBe(240);
    expect(robuxCost(250, DEFAULT_ROBUX_RATE)).toBe(600);
  });

  it("is zero for zero / negative / non-finite rerolls", () => {
    expect(robuxCost(0, DEFAULT_ROBUX_RATE)).toBe(0);
    expect(robuxCost(-50, DEFAULT_ROBUX_RATE)).toBe(0);
    expect(robuxCost(NaN, DEFAULT_ROBUX_RATE)).toBe(0);
  });

  it("handles partial batches and a 0% discount", () => {
    expect(
      robuxCost(25, { rerollUnit: 50, robuxPerUnit: 150, discountPct: 0 }),
    ).toBe(75);
  });

  it("clamps a silly discount and guards a zero unit", () => {
    expect(
      robuxCost(50, { rerollUnit: 0, robuxPerUnit: 150, discountPct: 999 }),
    ).toBe(0);
  });
});
