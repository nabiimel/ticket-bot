import { describe, expect, it } from "vitest";
import { groupMultiPersonResponses } from "./multiPerson.js";

describe("groupMultiPersonResponses", () => {
  it("returns null when there are no p<N>_ prefixed responses", () => {
    expect(
      groupMultiPersonResponses([
        { fieldKey: "gakuran_name", fieldLabel: "Gakuran Name", value: "Anne" },
      ]),
    ).toBeNull();
  });

  it("groups prefixed responses by person, sorted by index", () => {
    const result = groupMultiPersonResponses([
      {
        fieldKey: "p2_gakuran_name",
        fieldLabel: "Gakuran Name (Person 2)",
        value: "Janben",
      },
      {
        fieldKey: "p2_roblox_username",
        fieldLabel: "Roblox username (Person 2)",
        value: "benumbedx",
      },
      {
        fieldKey: "p2_rr_count",
        fieldLabel: "How many rerolls (Person 2)",
        value: "250",
      },
      {
        fieldKey: "p1_gakuran_name",
        fieldLabel: "Gakuran Name (Person 1)",
        value: "Anne",
      },
      {
        fieldKey: "p1_roblox_username",
        fieldLabel: "Roblox username (Person 1)",
        value: "xanneknownx",
      },
      {
        fieldKey: "p1_rr_count",
        fieldLabel: "How many rerolls (Person 1)",
        value: "500",
      },
    ]);

    expect(result).toEqual([
      { index: 1, name: "Anne", robloxUser: "xanneknownx", qty: 500 },
      { index: 2, name: "Janben", robloxUser: "benumbedx", qty: 250 },
    ]);
  });

  it("ignores non-prefixed responses mixed in (e.g. the is_reservation answer)", () => {
    const result = groupMultiPersonResponses([
      { fieldKey: "is_reservation", fieldLabel: "Reservation?", value: "Yes" },
      {
        fieldKey: "p1_gakuran_name",
        fieldLabel: "Gakuran Name (Person 1)",
        value: "Anne",
      },
    ]);
    expect(result).toEqual([
      { index: 1, name: "Anne", robloxUser: "", qty: 0 },
    ]);
  });
});
