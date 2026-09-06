import { afterEach, describe, expect, it } from "vitest";
import { devPasswordMatches } from "./dev-session";

const ORIGINAL = process.env.DEV_LOGIN_PASSWORD;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.DEV_LOGIN_PASSWORD;
  else process.env.DEV_LOGIN_PASSWORD = ORIGINAL;
});

describe("devPasswordMatches", () => {
  it("is always false when no secret is configured", () => {
    delete process.env.DEV_LOGIN_PASSWORD;
    expect(devPasswordMatches("")).toBe(false);
    expect(devPasswordMatches("anything")).toBe(false);
  });

  it("matches only the exact secret", () => {
    process.env.DEV_LOGIN_PASSWORD = "s3cret-value-123";
    expect(devPasswordMatches("s3cret-value-123")).toBe(true);
    expect(devPasswordMatches("s3cret-value-124")).toBe(false);
    expect(devPasswordMatches("s3cret-value-123 ")).toBe(false);
    expect(devPasswordMatches("")).toBe(false);
  });

  it("does not throw on non-string input", () => {
    process.env.DEV_LOGIN_PASSWORD = "x";
    expect(devPasswordMatches(undefined)).toBe(false);
    expect(devPasswordMatches(123)).toBe(false);
    expect(devPasswordMatches(null)).toBe(false);
  });
});
