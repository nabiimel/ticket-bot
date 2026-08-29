import { describe, expect, it } from "vitest";
import { isSupportedLanguage, t } from "./i18n.js";

describe("t()", () => {
  it("returns the English string for a known key", () => {
    expect(t("common.error")).toMatch(/wrong/i);
  });

  it("interpolates vars", () => {
    expect(t("ticket.open.limitReached", "en", { count: 3 })).toContain("3");
  });

  it("falls back to English for an unknown language", () => {
    expect(t("common.error", "xx")).toBe(t("common.error", "en"));
  });

  it("returns the raw key when it is unknown", () => {
    expect(t("nope.not.a.key")).toBe("nope.not.a.key");
  });
});

describe("isSupportedLanguage", () => {
  it("knows en and rejects others", () => {
    expect(isSupportedLanguage("en")).toBe(true);
    expect(isSupportedLanguage("de")).toBe(false);
  });
});
