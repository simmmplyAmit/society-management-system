import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { expense: { findMany: vi.fn() } } }));

import { prisma } from "@/lib/prisma";
import { getExpenses, getExpenseSummary } from "@/lib/queries/expenses";

const findMany = vi.mocked(prisma.expense.findMany);

describe("getExpenses", () => {
  beforeEach(() => vi.resetAllMocks());

  it("always scopes to the society", async () => {
    findMany.mockResolvedValue([]);
    await getExpenses("s1");
    expect(findMany.mock.calls[0][0]!.where).toEqual({ societyId: "s1" });
  });

  it("filters to a month when month and year are given", async () => {
    findMany.mockResolvedValue([]);
    await getExpenses("s1", 2, 2026);
    const where = findMany.mock.calls[0][0]!.where as { date: { gte: Date; lte: Date } };
    expect(where.date.gte).toEqual(new Date(2026, 1, 1));
    expect(where.date.lte.getMonth()).toBe(1);
    expect(where.date.lte.getDate()).toBe(28);
  });

  it("filters to the whole year when only year is given", async () => {
    findMany.mockResolvedValue([]);
    await getExpenses("s1", undefined, 2026);
    const where = findMany.mock.calls[0][0]!.where as { date: { gte: Date; lte: Date } };
    expect(where.date.gte).toEqual(new Date(2026, 0, 1));
    expect(where.date.lte.getMonth()).toBe(11);
  });
});

describe("getExpenseSummary", () => {
  beforeEach(() => vi.resetAllMocks());

  it("totals by month, category and overall", async () => {
    findMany.mockResolvedValue([
      { amount: 100, category: "Electricity", date: new Date(2026, 0, 5) },
      { amount: 50, category: "Electricity", date: new Date(2026, 0, 20) },
      { amount: 200, category: "Repairs", date: new Date(2026, 2, 1) },
    ] as never);
    const s = await getExpenseSummary("s1", 2026);
    expect(s.grandTotal).toBe(350);
    expect(s.byCategory).toEqual({ Electricity: 150, Repairs: 200 });
    expect(s.monthly).toHaveLength(12);
    expect(s.monthly[0].total).toBe(150);
    expect(s.monthly[2].total).toBe(200);
    expect(s.monthly[1].total).toBe(0);
  });

  it("returns zeros for a year with no expenses", async () => {
    findMany.mockResolvedValue([]);
    const s = await getExpenseSummary("s1", 2026);
    expect(s.grandTotal).toBe(0);
    expect(s.byCategory).toEqual({});
  });
});
