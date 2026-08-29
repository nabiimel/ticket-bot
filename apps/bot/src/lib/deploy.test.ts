import { describe, expect, it } from "vitest";
import { hashCommands } from "./deploy.js";

describe("hashCommands", () => {
  it("is stable for equal input and order-sensitive", () => {
    const a = [{ name: "ticket", description: "x" }];
    const b = [{ name: "ticket", description: "x" }];
    expect(hashCommands(a)).toBe(hashCommands(b));

    const reordered = [
      { name: "b", description: "2" },
      { name: "a", description: "1" },
    ];
    const original = [
      { name: "a", description: "1" },
      { name: "b", description: "2" },
    ];
    expect(hashCommands(reordered)).not.toBe(hashCommands(original));
  });

  it("changes when a command definition changes", () => {
    const before = [{ name: "ticket", description: "old" }];
    const after = [{ name: "ticket", description: "new" }];
    expect(hashCommands(before)).not.toBe(hashCommands(after));
  });
});
