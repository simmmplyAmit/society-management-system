import { describe, it, expect } from "vitest";
import { toIdx, periodsOverlap } from "@/actions/maintenance";

describe("toIdx", () => {
  it("converts month/year into a sortable integer", () => {
    expect(toIdx(1, 2024)).toBe(2024 * 12 + 1);
    expect(toIdx(12, 2024)).toBe(2024 * 12 + 12);
  });

  it("Jan of next year is greater than Dec of this year", () => {
    expect(toIdx(1, 2025)).toBeGreaterThan(toIdx(12, 2024));
  });

  it("same month/year produces the same index", () => {
    expect(toIdx(6, 2023)).toBe(toIdx(6, 2023));
  });
});

describe("periodsOverlap", () => {
  // helper so tests read naturally
  const idx = (m: number, y: number) => toIdx(m, y);

  it("returns false when first period ends before second starts", () => {
    expect(periodsOverlap(idx(1, 2024), idx(5, 2024), idx(6, 2024), null)).toBe(false);
  });

  it("returns false when second period ends before first starts", () => {
    expect(periodsOverlap(idx(6, 2024), null, idx(1, 2024), idx(5, 2024))).toBe(false);
  });

  it("returns true when periods share a single month boundary", () => {
    expect(periodsOverlap(idx(1, 2024), idx(6, 2024), idx(6, 2024), idx(12, 2024))).toBe(true);
  });

  it("returns true when one period contains the other", () => {
    expect(periodsOverlap(idx(1, 2024), idx(12, 2024), idx(3, 2024), idx(6, 2024))).toBe(true);
  });

  it("returns true when periods partially overlap", () => {
    expect(periodsOverlap(idx(1, 2024), idx(6, 2024), idx(4, 2024), idx(9, 2024))).toBe(true);
  });

  it("returns true when both are open-ended", () => {
    expect(periodsOverlap(idx(1, 2024), null, idx(6, 2024), null)).toBe(true);
  });

  it("returns true when first is open-ended and second starts after first", () => {
    expect(periodsOverlap(idx(1, 2024), null, idx(6, 2026), null)).toBe(true);
  });

  it("returns true when second is open-ended and first is still active at that point", () => {
    expect(periodsOverlap(idx(1, 2024), idx(12, 2025), idx(6, 2025), null)).toBe(true);
  });

  it("returns false for adjacent months (no shared month)", () => {
    // Jan–May ends, Jun starts → no overlap
    expect(periodsOverlap(idx(1, 2024), idx(5, 2024), idx(6, 2024), idx(12, 2024))).toBe(false);
  });
});
