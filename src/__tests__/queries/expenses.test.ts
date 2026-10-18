import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { expense: { findMany: vi.fn() } } }));

import { prisma } from "@/lib/prisma";
import { getExpenses, getExpenseAnalytics } from "@/lib/queries/expenses";

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

describe("getExpenseAnalytics", () => {
  beforeEach(() => vi.resetAllMocks());

  it("scopes to the society", async () => {
    findMany.mockResolvedValue([]);
    await getExpenseAnalytics("s1");
    expect(findMany.mock.calls[0][0]!.where).toEqual({ societyId: "s1" });
  });

  it("aggregates by year, month and category across years", async () => {
    findMany.mockResolvedValue([
      { amount: 100, category: "Electricity", date: new Date(2025, 11, 5) },
      { amount: 50, category: "Electricity", date: new Date(2026, 0, 5) },
      { amount: 25, category: "Electricity", date: new Date(2026, 0, 20) },
      { amount: 200, category: "Repairs", date: new Date(2026, 2, 1) },
    ] as never);
    const a = await getExpenseAnalytics("s1");
    expect(a.total).toBe(375);
    expect(a.years).toEqual([2025, 2026]);
    expect(a.yearly).toEqual([
      { year: 2025, total: 100 },
      { year: 2026, total: 275 },
    ]);
    expect(a.monthly).toContainEqual({ year: 2026, month: 1, total: 75 });
    expect(a.monthly).toContainEqual({ year: 2026, month: 3, total: 200 });
    expect(a.monthly).toHaveLength(3);
    expect(a.byCategory).toContainEqual({ year: 2026, category: "Electricity", total: 75 });
    expect(a.byCategory).toContainEqual({ year: 2025, category: "Electricity", total: 100 });
    expect(a.byCategory).toHaveLength(3);
  });

  it("returns empty aggregates with no expenses", async () => {
    findMany.mockResolvedValue([]);
    const a = await getExpenseAnalytics("s1");
    expect(a).toEqual({ years: [], total: 0, yearly: [], monthly: [], byCategory: [] });
  });
});
