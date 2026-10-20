import { describe, it, expect } from "vitest";
import { duesNote, selectedTotal, dueBalance } from "@/lib/utils/dues";

const d = (month: number, year: number, amount: number | string = 1000) => ({ month, year, amount });

describe("selectedTotal", () => {
  it("sums numbers and numeric strings", () => {
    expect(selectedTotal([d(1, 2026, 2500), d(2, 2026, "3000.50")])).toBe(5500.5);
    expect(selectedTotal([])).toBe(0);
  });

  it("counts only what is still owed on part-paid dues", () => {
    expect(selectedTotal([{ month: 1, year: 2026, amount: 2500, amountPaid: 1000 }, d(2, 2026, 2500)])).toBe(4000);
    expect(dueBalance({ amount: 10.3, amountPaid: 10.1 })).toBe(0.2); // no float drift
    expect(dueBalance({ amount: 100, amountPaid: 150 })).toBe(0); // never negative
    expect(dueBalance({ amount: 100 })).toBe(100);
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

describe("labels", () => {
  it("titles maintenance by month and other charges with their name", async () => {
    const { dueTitle } = await import("@/lib/utils/dues");
    expect(dueTitle({ month: 10, year: 2026 })).toBe("October 2026");
    expect(dueTitle({ label: "Maintenance", month: 10, year: 2026 })).toBe("October 2026");
    expect(dueTitle({ label: "Sinking fund", month: 10, year: 2026 })).toBe("Sinking fund · October 2026");
  });

  it("writes 'Dues' in the UPI note when any other charge is included", () => {
    expect(duesNote([{ month: 10, year: 2026, amount: 1, label: "Sinking fund" }, d(9, 2026)])).toBe("Dues Sep 2026, Oct 2026");
    expect(duesNote([d(9, 2026)])).toBe("Maintenance Sep 2026");
  });
});
