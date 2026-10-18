import { describe, it, expect } from "vitest";
import { isBeforeCurrentMonth, previousMonth } from "@/lib/utils/maintenance";

const now = new Date(2026, 9, 15); // 15 Oct 2026

describe("isBeforeCurrentMonth", () => {
  it("is true for earlier months and years", () => {
    expect(isBeforeCurrentMonth(9, 2026, now)).toBe(true);
    expect(isBeforeCurrentMonth(12, 2025, now)).toBe(true);
  });
  it("is false for the current and later months", () => {
    expect(isBeforeCurrentMonth(10, 2026, now)).toBe(false);
    expect(isBeforeCurrentMonth(11, 2026, now)).toBe(false);
    expect(isBeforeCurrentMonth(1, 2027, now)).toBe(false);
  });
});

describe("previousMonth", () => {
  it("steps back within a year", () => {
    expect(previousMonth(10, 2026)).toEqual({ month: 9, year: 2026 });
  });
  it("wraps January to December of the previous year", () => {
    expect(previousMonth(1, 2026)).toEqual({ month: 12, year: 2025 });
  });
});
