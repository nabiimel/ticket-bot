import { describe, expect, it } from "vitest";
import { parseUploadUrl } from "./embedAssets.js";

describe("parseUploadUrl", () => {
  it("parses a well-formed upload path", () => {
    expect(parseUploadUrl("/u/123456789012345678/abc-DEF_1.png")).toEqual({
      guildId: "123456789012345678",
      file: "abc-DEF_1.png",
    });
  });

  it("rejects non-upload URLs", () => {
    expect(parseUploadUrl("https://example.com/x.png")).toBeNull();
    expect(parseUploadUrl(undefined)).toBeNull();
    expect(parseUploadUrl("")).toBeNull();
    expect(parseUploadUrl("attachment://x.png")).toBeNull();
  });

  it("rejects traversal and malformed shapes", () => {
    expect(parseUploadUrl("/u/123/../secret")).toBeNull();
    expect(parseUploadUrl("/u/123/a/b.png")).toBeNull();
    expect(parseUploadUrl("/u/notanid/a.png")).toBeNull();
    expect(parseUploadUrl("/u/123/noext")).toBeNull();
  });
});
