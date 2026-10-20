// Server-only data access (not a "use server" file). Pass a societyId taken from the session.
import { prisma } from "@/lib/prisma";

export async function getIncomes(societyId: string, year: number) {
  return prisma.income.findMany({
    where: { societyId, date: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59) } },
    include: { addedBy: { select: { name: true } } },
    orderBy: { date: "desc" },
  });
}

export interface IncomeSummary {
  incomeTotal: number;
  expenseTotal: number;
  byCategory: { category: string; total: number }[]; // largest first
}

/** Other income vs expenses for one calendar year. Dues collected are not counted here. */
export async function getIncomeSummary(societyId: string, year: number): Promise<IncomeSummary> {
  const range = { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59) };
  const [incomes, expenses] = await Promise.all([
    prisma.income.findMany({ where: { societyId, date: range }, select: { amount: true, category: true } }),
    prisma.expense.aggregate({ where: { societyId, date: range }, _sum: { amount: true } }),
  ]);
  const cats = new Map<string, number>();
  let paise = 0;
  for (const i of incomes) {
    const p = Math.round(Number(i.amount) * 100);
    paise += p;
    cats.set(i.category, (cats.get(i.category) ?? 0) + p);
  }
  return {
    incomeTotal: paise / 100,
    expenseTotal: Number(expenses._sum.amount ?? 0),
    byCategory: [...cats].map(([category, p]) => ({ category, total: p / 100 })).sort((a, b) => b.total - a.total),
  };
}
