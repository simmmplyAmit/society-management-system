"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const expenseSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  category: z.string().min(1, "Select a category"),
  amount: z.coerce.number().positive("Amount must be positive"),
  date: z.string().min(1, "Date is required"),
  description: z.string().optional(),
});

export async function addExpense(formData: FormData) {
  const session = await requireRole(["TREASURER", "ADMIN"]);
  const societyId = session.user.societyId!;

  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.expense.create({
    data: {
      societyId,
      title: parsed.data.title,
      category: parsed.data.category,
      amount: parsed.data.amount,
      date: new Date(parsed.data.date),
      description: parsed.data.description || null,
      addedById: session.user.id,
    },
  });

  revalidatePath("/dashboard/expenses");
  return { success: true };
}

export async function deleteExpense(expenseId: string) {
  const session = await requireRole(["TREASURER", "ADMIN"]);
  const societyId = session.user.societyId!;

  await prisma.expense.deleteMany({
    where: { id: expenseId, societyId },
  });

  revalidatePath("/dashboard/expenses");
  return { success: true as const, error: undefined };
}

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
