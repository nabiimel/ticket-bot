import { describe, expect, it } from "vitest";
import { validateFormAnswer } from "./formValidation.js";
import type { FormField } from "./types.js";

const base: FormField = {
  key: "age",
  label: "Age",
  style: "short",
  required: false,
};

describe("validateFormAnswer", () => {
  it("allows an empty optional field", () => {
    expect(validateFormAnswer(base, "")).toBeNull();
  });

  it("rejects an empty required field", () => {
    expect(validateFormAnswer({ ...base, required: true }, "")).toMatch(
      /required/,
    );
  });

  it("accepts digits-only for a numeric field", () => {
    expect(
      validateFormAnswer({ ...base, validation: "numeric" }, "42"),
    ).toBeNull();
  });

  it("rejects non-digits for a numeric field", () => {
    expect(
      validateFormAnswer({ ...base, validation: "numeric" }, "42 years"),
    ).toMatch(/numbers only/);
  });

  it("rejects a decimal for a numeric field", () => {
    expect(
      validateFormAnswer({ ...base, validation: "numeric" }, "4.2"),
    ).toMatch(/numbers only/);
  });

  it("does not apply numeric validation to non-numeric fields", () => {
    expect(validateFormAnswer(base, "not a number")).toBeNull();
  });
});
