import { describe, it, expect } from "vitest";
import { flatLabel, flatOptionLabel } from "@/lib/utils/flat";

const flat = {
  number: "101",
  floor: { number: 1, wing: { name: "A" } },
};

describe("flatLabel", () => {
  it("includes wing prefix when hasWings is true", () => {
    expect(flatLabel(flat, true)).toBe("Wing A · F1 · 101");
  });

  it("omits wing prefix when hasWings is false", () => {
    expect(flatLabel(flat, false)).toBe("Floor 1 · Flat 101");
  });

  it("uses the wing name from the flat data", () => {
    const flatB = { number: "202", floor: { number: 2, wing: { name: "B" } } };
    expect(flatLabel(flatB, true)).toBe("Wing B · F2 · 202");
  });

  it("works with _default_ wing name in wingless mode", () => {
    const winglessFlat = { number: "101", floor: { number: 1, wing: { name: "_default_" } } };
    expect(flatLabel(winglessFlat, false)).toBe("Floor 1 · Flat 101");
  });
});

describe("flatOptionLabel", () => {
  it("includes full wing/floor/flat path when hasWings is true", () => {
    expect(flatOptionLabel(flat, true)).toBe("Wing A · Floor 1 · Flat 101");
  });

  it("omits wing when hasWings is false", () => {
    expect(flatOptionLabel(flat, false)).toBe("Floor 1 · Flat 101");
  });
});
