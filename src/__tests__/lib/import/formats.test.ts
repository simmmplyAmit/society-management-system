import { describe, it, expect } from "vitest";
import { floorFromFlatNumber, parseAmount, parseDate, parseFloor, parseMonth, parseYesNo } from "@/lib/import/formats";

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));

describe("parseAmount", () => {
  it.each([
    ["2500", 2500],
    ["₹1,200.50", 1200.5],
    ["Rs. 1,00,000", 100000],
    ["1200/-", 1200],
    ["INR 99.999", 100],
  ])("%s → %s", (raw, expected) => expect(parseAmount(raw)).toBe(expected));

  it.each(["", "-", "abc", "-50", "12.3.4"])("rejects %j", (raw) => expect(parseAmount(raw)).toBeNull());
});

describe("parseDate", () => {
  it("reads day-first numeric dates", () => {
    expect(parseDate("15/04/2025")).toEqual(d(2025, 4, 15));
    expect(parseDate("5-4-25")).toEqual(d(2025, 4, 5));
    expect(parseDate("05.04.2025")).toEqual(d(2025, 4, 5));
  });

  it("reads ISO dates and month names", () => {
    expect(parseDate("2025-04-15")).toEqual(d(2025, 4, 15));
    expect(parseDate("2025-04-15T00:00:00")).toEqual(d(2025, 4, 15));
    expect(parseDate("15 Apr 2025")).toEqual(d(2025, 4, 15));
    expect(parseDate("15-Sept-25")).toEqual(d(2025, 9, 15));
    expect(parseDate("April 15, 2025")).toEqual(d(2025, 4, 15));
  });

  it("rejects impossible dates", () => {
    expect(parseDate("31/04/2025")).toBeNull();
    expect(parseDate("29/02/2025")).toBeNull();
    expect(parseDate("13/13/2025")).toBeNull();
    expect(parseDate("someday")).toBeNull();
  });
});

describe("parseMonth", () => {
  it.each([
    ["04/2025", { month: 4, year: 2025 }],
    ["4-25", { month: 4, year: 2025 }],
    ["2025-04", { month: 4, year: 2025 }],
    ["Apr 2025", { month: 4, year: 2025 }],
    ["April-2025", { month: 4, year: 2025 }],
    ["Apr'25", { month: 4, year: 2025 }],
    ["01/04/2025", { month: 4, year: 2025 }],
  ])("%s", (raw, expected) => expect(parseMonth(raw)).toEqual(expected));

  it.each(["13/2025", "Ap 2025", "Smarch 2025", ""])("rejects %j", (raw) => expect(parseMonth(raw)).toBeNull());
});

describe("floors", () => {
  it("parses floor names", () => {
    expect(parseFloor("G")).toBe(0);
    expect(parseFloor("Ground")).toBe(0);
    expect(parseFloor("3rd")).toBe(3);
    expect(parseFloor("Floor 12")).toBe(12);
    expect(parseFloor("basement")).toBe(-1);
    expect(parseFloor("top")).toBeNull();
  });

  it("guesses the floor from the flat number", () => {
    expect(floorFromFlatNumber("101")).toBe(1);
    expect(floorFromFlatNumber("A-1203")).toBe(12);
    expect(floorFromFlatNumber("G01")).toBe(0);
    expect(floorFromFlatNumber("7")).toBeNull();
    expect(floorFromFlatNumber("Shop")).toBeNull();
  });
});

describe("parseYesNo", () => {
  it("treats blank as no and rejects other words", () => {
    expect(parseYesNo("Yes")).toBe(true);
    expect(parseYesNo("")).toBe(false);
    expect(parseYesNo("n")).toBe(false);
    expect(parseYesNo("maybe")).toBeNull();
  });
});
