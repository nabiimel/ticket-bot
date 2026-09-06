import { describe, expect, it } from "vitest";
import { slidingWindowHit } from "./pingGuard.js";

describe("slidingWindowHit", () => {
  it("only reports over once the count exceeds max within the window", () => {
    const store = new Map<string, number[]>();
    const w = 60_000;
    // max = 3 → the 4th ping inside the window trips it.
    expect(slidingWindowHit(store, "k", 0, w, 3).over).toBe(false);
    expect(slidingWindowHit(store, "k", 1_000, w, 3).over).toBe(false);
    expect(slidingWindowHit(store, "k", 2_000, w, 3).over).toBe(false);
    const hit = slidingWindowHit(store, "k", 3_000, w, 3);
    expect(hit.over).toBe(true);
    expect(hit.count).toBe(4);
  });

  it("forgets pings that fall outside the window", () => {
    const store = new Map<string, number[]>();
    const w = 60_000;
    slidingWindowHit(store, "k", 0, w, 3);
    slidingWindowHit(store, "k", 10_000, w, 3);
    slidingWindowHit(store, "k", 20_000, w, 3);
    // 90s later the first three are stale; this is effectively ping #1 again.
    expect(slidingWindowHit(store, "k", 90_000, w, 3).over).toBe(false);
  });

  it("keeps separate counts per key", () => {
    const store = new Map<string, number[]>();
    const w = 60_000;
    for (let i = 0; i < 4; i++) slidingWindowHit(store, "a", i * 100, w, 3);
    expect(slidingWindowHit(store, "b", 0, w, 3).over).toBe(false);
  });
});
