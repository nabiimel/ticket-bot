import { describe, expect, it, vi, afterEach } from "vitest";
import { hit } from "./cooldown.js";

afterEach(() => vi.useRealTimers());

describe("cooldown.hit", () => {
  it("allows the first hit and blocks a repeat inside the window", () => {
    const key = `k-${Math.random()}`;
    expect(hit(key, 1000)).toBe(true);
    expect(hit(key, 1000)).toBe(false);
    expect(hit(key, 1000)).toBe(false);
  });

  it("allows again once the window elapses", () => {
    vi.useFakeTimers();
    const key = `k-${Math.random()}`;
    expect(hit(key, 1000)).toBe(true);
    vi.advanceTimersByTime(999);
    expect(hit(key, 1000)).toBe(false);
    vi.advanceTimersByTime(2);
    expect(hit(key, 1000)).toBe(true);
  });

  it("tracks keys independently", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(hit(a, 1000)).toBe(true);
    expect(hit(b, 1000)).toBe(true);
    expect(hit(a, 1000)).toBe(false);
  });
});
