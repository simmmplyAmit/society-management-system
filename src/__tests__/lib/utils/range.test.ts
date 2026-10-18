import { describe, it, expect } from "vitest";
import { expandFloorRange, expandFlatRange, rangeSummary, MAX_RANGE } from "@/lib/utils/range";

describe("expandFloorRange", () => {
  it("expands inclusively", () => {
    expect(expandFloorRange(1, 4).values).toEqual([1, 2, 3, 4]);
    expect(expandFloorRange(0, 0).values).toEqual([0]);
  });
  it("rejects a descending range", () => {
    expect(expandFloorRange(5, 2).error).toMatch(/same as or higher/);
  });
  it("caps the size of a range", () => {
    expect(expandFloorRange(0, MAX_RANGE).error).toMatch(/at most/);
    expect(expandFloorRange(1, MAX_RANGE).values).toHaveLength(MAX_RANGE);
  });
});

describe("expandFlatRange", () => {
  it("expands plain numbers", () => {
    expect(expandFlatRange("101", "104").values).toEqual(["101", "102", "103", "104"]);
  });
  it("keeps a prefix", () => {
    expect(expandFlatRange("A-101", "103").values).toEqual(["A-101", "A-102", "A-103"]);
  });
  it("accepts the prefix repeated on the end value", () => {
    expect(expandFlatRange("A-101", "A-102").values).toEqual(["A-101", "A-102"]);
  });
  it("keeps zero padding", () => {
    expect(expandFlatRange("001", "003").values).toEqual(["001", "002", "003"]);
    expect(expandFlatRange("008", "010").values).toEqual(["008", "009", "010"]);
  });
  it("trims whitespace", () => {
    expect(expandFlatRange(" 101 ", " 102 ").values).toEqual(["101", "102"]);
  });
  it("rejects a start that does not end in digits", () => {
    expect(expandFlatRange("PH", "5").error).toMatch(/end in digits/);
  });
  it("rejects a non-numeric end", () => {
    expect(expandFlatRange("101", "abc").error).toMatch(/must be a number/);
    expect(expandFlatRange("A-101", "B-105").error).toMatch(/must be a number/);
  });
  it("rejects a descending range", () => {
    expect(expandFlatRange("110", "101").error).toMatch(/same as or higher/);
  });
  it("caps the size of a range", () => {
    expect(expandFlatRange("1", String(MAX_RANGE + 1)).error).toMatch(/at most/);
  });
});

describe("rangeSummary", () => {
  it("pluralises and mentions skipped", () => {
    expect(rangeSummary("floor", 1, 0)).toBe("Added 1 floor");
    expect(rangeSummary("flat", 5, 0)).toBe("Added 5 flats");
    expect(rangeSummary("flat", 3, 2)).toBe("Added 3 flats (2 already existed)");
  });
});
