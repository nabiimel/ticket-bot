import { describe, expect, it } from "vitest";
import {
  parseRerollSplit,
  validateFormAnswer,
  validateRerollSplitSum,
} from "./formValidation.js";
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

describe("parseRerollSplit", () => {
  it("parses multiple name - count pairs", () => {
    expect(
      parseRerollSplit(
        "Anne - 500 / Janben - 250 / Yelly - 250 / Seia - 200 / Saki - 200 / Yuri - 200",
      ),
    ).toEqual([
      { name: "Anne", count: 500 },
      { name: "Janben", count: 250 },
      { name: "Yelly", count: 250 },
      { name: "Seia", count: 200 },
      { name: "Saki", count: 200 },
      { name: "Yuri", count: 200 },
    ]);
  });

  it("returns null for a malformed segment", () => {
    expect(parseRerollSplit("Anne - 500 / Janben")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseRerollSplit("")).toBeNull();
  });
});

describe("validateRerollSplitSum", () => {
  const splitField: FormField = {
    key: "names",
    label: "Gakuran Name",
    style: "paragraph",
    required: true,
    validation: "reroll-split",
    sumField: "qty",
  };

  it("allows an empty value (required-ness is checked separately)", () => {
    expect(
      validateRerollSplitSum(splitField, "", "RR count", "1600"),
    ).toBeNull();
  });

  it("accepts a breakdown that sums to exactly the total", () => {
    expect(
      validateRerollSplitSum(
        splitField,
        "Anne - 500 / Janben - 250 / Yelly - 250 / Seia - 200 / Saki - 200 / Yuri - 200",
        "RR count",
        "1600",
      ),
    ).toBeNull();
  });

  it("accepts a breakdown that sums to under the total", () => {
    expect(
      validateRerollSplitSum(splitField, "Anne - 500", "RR count", "1600"),
    ).toBeNull();
  });

  it("rejects a breakdown that sums past the total", () => {
    expect(
      validateRerollSplitSum(
        splitField,
        "Anne - 900 / Janben - 800",
        "RR count",
        "1600",
      ),
    ).toMatch(/adds up to 1700.*more than the 1600/);
  });

  it("rejects a malformed breakdown", () => {
    expect(
      validateRerollSplitSum(splitField, "Anne, 500", "RR count", "1600"),
    ).toMatch(/Name - count/);
  });
});
