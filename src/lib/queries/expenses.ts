// Server-only data access. Deliberately NOT a "use server" file: exports here must
// never become client-callable endpoints. Pass a societyId taken from the session.
import { prisma } from "@/lib/prisma";

export async function getExpenses(
  societyId: string,
  month?: number,
  year?: number
) {
  const where: Record<string, unknown> = { societyId };

  if (month && year) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);
    where.date = { gte: start, lte: end };
  } else if (year) {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);
    where.date = { gte: start, lte: end };
  }

  return prisma.expense.findMany({
    where,
    include: {
      addedBy: { select: { name: true } },
      documents: { where: { status: "READY" }, select: { id: true, title: true, fileName: true, mimeType: true }, orderBy: { createdAt: "asc" } },
      // Members who paid some of it themselves (and are credited)
      contributions: {
        where: { status: { in: ["APPROVED", "PENDING"] } },
        select: { id: true, amount: true, status: true, member: { select: { name: true } } },
      },
    },
    orderBy: { date: "desc" },
  });
}

export interface ExpenseAnalytics {
  years: number[]; // ascending, only years that have expenses
  total: number;
  yearly: { year: number; total: number }[];
  monthly: { year: number; month: number; total: number }[]; // month 1-12, non-zero only
  byCategory: { year: number; category: string; total: number }[]; // non-zero only
}

// All-time aggregates, sliced client-side into the all-time / yearly / monthly / type views.
export async function getExpenseAnalytics(
  societyId: string
): Promise<ExpenseAnalytics> {
  const expenses = await prisma.expense.findMany({
    where: { societyId },
    select: { amount: true, category: true, date: true },
  });

  const yearly = new Map<number, number>();
  const monthly = new Map<string, number>();
  const byCategory = new Map<string, number>();
  let total = 0;

  for (const e of expenses) {
    const d = new Date(e.date);
    const year = d.getFullYear();
    const amount = Number(e.amount);
    total += amount;
    yearly.set(year, (yearly.get(year) ?? 0) + amount);
    const mk = `${year}-${d.getMonth() + 1}`;
    monthly.set(mk, (monthly.get(mk) ?? 0) + amount);
    const ck = `${year}\u0000${e.category}`;
    byCategory.set(ck, (byCategory.get(ck) ?? 0) + amount);
  }

  const years = [...yearly.keys()].sort((a, b) => a - b);
  return {
    years,
    total,
    yearly: years.map((year) => ({ year, total: yearly.get(year)! })),
    monthly: [...monthly].map(([k, t]) => {
      const [year, month] = k.split("-").map(Number);
      return { year, month, total: t };
    }),
    byCategory: [...byCategory].map(([k, t]) => {
      const [year, category] = k.split("\u0000");
      return { year: Number(year), category, total: t };
    }),
  };
}

/** Credit a member's own expense request is waiting for a second person. */
export async function getPendingContributions(societyId: string) {
  return prisma.expenseContribution.findMany({
    where: { societyId, status: "PENDING", expenseId: { not: null } },
    include: {
      member: { select: { name: true } },
      requestedBy: { select: { name: true } },
      expense: { select: { amount: true, date: true, receiptUrl: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

/** What the society currently owes members: credit they hold and have not yet spent on dues. */
export async function getMemberCreditSummary(societyId: string) {
  const rows = await prisma.creditEntry.groupBy({
    by: ["userId"],
    where: { societyId },
    _sum: { amount: true },
  });
  const held = rows
    .map((r) => ({ userId: r.userId, balance: Math.round(Number(r._sum.amount ?? 0) * 100) / 100 }))
    .filter((r) => r.balance > 0);
  return {
    total: Math.round(held.reduce((n, r) => n + r.balance * 100, 0)) / 100,
    members: held.length,
  };
}
