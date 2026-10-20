import { describe, it, expect } from "vitest";
import { buildStatement } from "@/lib/utils/statement";

const d = (m: number, day = 10) => new Date(2026, m - 1, day);

describe("buildStatement", () => {
  it("is all zeros when nothing happened", () => {
    const s = buildStatement({ deposits: [], incomes: [], expenses: [], memberPaid: [] });
    expect(s.months).toHaveLength(12);
    expect(s.totals).toEqual({ dues: 0, otherIncome: 0, expenses: 0, memberPaid: 0, net: 0 });
  });

  it("nets dues and other income against expenses by month", () => {
    const s = buildStatement({
      deposits: [{ amount: 1000, date: d(1) }, { amount: 500.5, date: d(1, 20) }, { amount: 200, date: d(2) }],
      incomes: [{ amount: 100.25, date: d(1), category: "Bank interest" }],
      expenses: [{ amount: 700, date: d(1), category: "Electricity" }],
      memberPaid: [],
    });
    expect(s.months[0]).toMatchObject({ dues: 1500.5, otherIncome: 100.25, expenses: 700, net: 900.75 });
    expect(s.months[1].net).toBe(200);
    expect(s.totals.net).toBe(1100.75);
  });

  it("does not deduct the part of an expense members paid (settled against their dues)", () => {
    const s = buildStatement({
      deposits: [{ amount: 1000, date: d(3) }],
      incomes: [],
      expenses: [{ amount: 600, date: d(3), category: "Repairs" }],
      memberPaid: [{ amount: 250, date: d(3) }],
    });
    expect(s.totals).toMatchObject({ expenses: 600, memberPaid: 250, net: 650 });
  });

  it("avoids floating point drift and ranks categories", () => {
    const s = buildStatement({
      deposits: [],
      incomes: [
        { amount: 0.1, date: d(1), category: "A" },
        { amount: 0.2, date: d(1), category: "A" },
        { amount: 5, date: d(1), category: "B" },
      ],
      expenses: [],
      memberPaid: [],
    });
    expect(s.incomeByCategory).toEqual([{ category: "B", total: 5 }, { category: "A", total: 0.3 }]);
    expect(s.totals.otherIncome).toBe(5.3);
  });

  it("reports a deficit as negative net", () => {
    const s = buildStatement({ deposits: [], incomes: [], expenses: [{ amount: 50, date: d(5), category: "X" }], memberPaid: [] });
    expect(s.totals.net).toBe(-50);
  });
});
