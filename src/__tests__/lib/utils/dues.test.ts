import { describe, it, expect } from "vitest";
import { duesNote, selectedTotal } from "@/lib/utils/dues";

const d = (month: number, year: number, amount: number | string = 1000) => ({ month, year, amount });

describe("selectedTotal", () => {
  it("sums numbers and numeric strings", () => {
    expect(selectedTotal([d(1, 2026, 2500), d(2, 2026, "3000.50")])).toBe(5500.5);
    expect(selectedTotal([])).toBe(0);
  });
});

describe("duesNote", () => {
  it("lists months oldest first", () => {
    expect(duesNote([d(10, 2026), d(9, 2026)])).toBe("Maintenance Sep 2026, Oct 2026");
  });

  it("falls back to a count when the list would be too long for a UPI note", () => {
    const many = [1, 2, 3, 4, 5, 6].map((m) => d(m, 2026));
    const note = duesNote(many);
    expect(note).toBe("Maintenance 6 months");
    expect(note.length).toBeLessThanOrEqual(50);
  });

  it("handles an empty selection and duplicate periods across flats", () => {
    expect(duesNote([])).toBe("Maintenance");
    expect(duesNote([d(10, 2026), d(10, 2026)])).toBe("Maintenance Oct 2026");
  });
});
