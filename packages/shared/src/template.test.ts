import { describe, expect, it } from "vitest";
import { hexToInt, renderEmbedConfig, renderTemplate } from "./template.js";

describe("renderTemplate", () => {
  const ctx = { user: "Ada", "ticket.number": 7, "guild.name": "HQ" };

  it("substitutes known tokens", () => {
    expect(renderTemplate("hi {user}, #{ticket.number}", ctx)).toBe(
      "hi Ada, #7",
    );
  });

  it("leaves unknown tokens untouched", () => {
    expect(renderTemplate("{user} {nope}", ctx)).toBe("Ada {nope}");
  });

  it("resolves dotted form-answer tokens", () => {
    const c = { "form.issue": "cannot log in", "form.all": "a\nb" };
    expect(renderTemplate("Issue: {form.issue}\n{form.all}", c)).toBe(
      "Issue: cannot log in\na\nb",
    );
  });

  it("passes through empty / nullish input", () => {
    expect(renderTemplate("", ctx)).toBe("");
    expect(renderTemplate(undefined, ctx)).toBeUndefined();
    expect(renderTemplate(null, ctx)).toBeUndefined();
  });
});

describe("renderEmbedConfig", () => {
  it("renders every string field and preserves structure", () => {
    const out = renderEmbedConfig(
      {
        title: "T {user}",
        description: "D {ticket.number}",
        footer: { text: "f {guild.name}" },
        author: { name: "a {user}" },
        color: "#fff",
      },
      { user: "Ada", "ticket.number": 7, "guild.name": "HQ" },
    );
    expect(out.title).toBe("T Ada");
    expect(out.description).toBe("D 7");
    expect(out.footer?.text).toBe("f HQ");
    expect(out.author?.name).toBe("a Ada");
    expect(out.color).toBe("#fff");
  });
});

describe("hexToInt", () => {
  it("parses with and without leading #", () => {
    expect(hexToInt("#5865F2")).toBe(0x5865f2);
    expect(hexToInt("57F287")).toBe(0x57f287);
  });
  it("falls back on invalid input", () => {
    expect(hexToInt(undefined)).toBe(0x5865f2);
    expect(hexToInt("nope")).toBe(0x5865f2);
    expect(hexToInt("#12345")).toBe(0x5865f2);
  });
});
