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
    },
    orderBy: { date: "desc" },
  });
}

export async function getExpenseSummary(societyId: string, year: number) {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59);

  const expenses = await prisma.expense.findMany({
    where: { societyId, date: { gte: start, lte: end } },
    select: { amount: true, category: true, date: true },
  });

  // Monthly totals
  const monthly = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    total: 0,
  }));

  // Category totals
  const byCategory: Record<string, number> = {};

  let grandTotal = 0;

  for (const e of expenses) {
    const m = new Date(e.date).getMonth(); // 0-indexed
    monthly[m].total += Number(e.amount);
    grandTotal += Number(e.amount);

    const cat = e.category;
    byCategory[cat] = (byCategory[cat] ?? 0) + Number(e.amount);
  }

  return { monthly, byCategory, grandTotal };
}
