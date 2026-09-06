import { afterEach, describe, expect, it } from "vitest";
import { devDiscordIds, isDevDiscordId } from "./dev-session";

const ORIGINAL = process.env.DEV_DISCORD_IDS;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.DEV_DISCORD_IDS;
  else process.env.DEV_DISCORD_IDS = ORIGINAL;
});

describe("dev-session", () => {
  it("grants nobody when unset", () => {
    delete process.env.DEV_DISCORD_IDS;
    expect(devDiscordIds().size).toBe(0);
    expect(isDevDiscordId("123")).toBe(false);
    expect(isDevDiscordId(undefined)).toBe(false);
    expect(isDevDiscordId(null)).toBe(false);
  });

  it("parses comma- and space-separated ids", () => {
    process.env.DEV_DISCORD_IDS = " 111,222   333 , 444 ";
    expect([...devDiscordIds()].sort()).toEqual(["111", "222", "333", "444"]);
    expect(isDevDiscordId("222")).toBe(true);
    expect(isDevDiscordId("999")).toBe(false);
    expect(isDevDiscordId("")).toBe(false);
  });

  it("takes effect without any restart/re-import (reads env each call)", () => {
    process.env.DEV_DISCORD_IDS = "";
    expect(isDevDiscordId("777")).toBe(false);
    process.env.DEV_DISCORD_IDS = "777";
    expect(isDevDiscordId("777")).toBe(true);
  });
});
