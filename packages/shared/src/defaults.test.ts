import { describe, expect, it } from "vitest";
import { isValidEmoji } from "./defaults.js";

describe("isValidEmoji", () => {
  it("accepts a single unicode emoji", () => {
    expect(isValidEmoji("🎫")).toBe(true);
    expect(isValidEmoji("⚠️")).toBe(true);
  });

  it("accepts Discord custom emoji tokens", () => {
    expect(isValidEmoji("<:name:123456789012345678>")).toBe(true);
    expect(isValidEmoji("<a:spin:123456789012345678>")).toBe(true);
  });

  it("rejects plain text and empty input", () => {
    expect(isValidEmoji("support")).toBe(false);
    expect(isValidEmoji("")).toBe(false);
    expect(isValidEmoji("   ")).toBe(false);
  });

  it("rejects malformed custom tokens", () => {
    expect(isValidEmoji("<:name:>")).toBe(false);
    expect(isValidEmoji(":name:")).toBe(false);
  });
});
