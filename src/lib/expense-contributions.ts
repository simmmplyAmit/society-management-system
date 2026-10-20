// Server-only. Expenses that members paid out of pocket: the society owes them, so they are credited
// (credit can only be spent on dues, see ledger.ts). Everything for one expense commits together.
import { prisma } from "@/lib/prisma";
import { depositAndApplyIn, reverseExpenseCreditIn, InsufficientCreditError, type Applied } from "@/lib/ledger";

export interface ContributionInput {
  userId: string;
  amount: number;
}

export interface NewExpense {
  societyId: string;
  actorId: string;
  title: string;
  category: string;
  amount: number;
  date: Date;
  description: string | null;
  receiptUrl: string | null;
}

export interface CreateResult {
  expenseId: string;
  /** Members credited right away. */
  credited: { userId: string; amount: number }[];
  /** Contributions waiting for a second person because the recorder tagged themselves. */
  pending: number;
  /** Dues the new credit paid, for receipts. */
  applied: Applied[];
}

/**
 * Record the expense and its member contributions in one transaction. Contributions for other
 * members are credited immediately; one for the recorder themselves waits for another
 * admin/treasurer, so nobody can credit their own account alone.
 */
export async function createExpenseWithContributions(
  e: NewExpense,
  contributions: ContributionInput[]
): Promise<CreateResult> {
  // Lock members in a fixed order so two concurrent expenses can never deadlock
  const ordered = [...contributions].sort((a, b) => a.userId.localeCompare(b.userId));

  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        societyId: e.societyId, title: e.title, category: e.category, amount: e.amount, date: e.date,
        description: e.description, receiptUrl: e.receiptUrl, addedById: e.actorId,
      },
      select: { id: true },
    });

    const result: CreateResult = { expenseId: expense.id, credited: [], pending: 0, applied: [] };

    for (const c of ordered) {
      const base = {
        societyId: e.societyId, expenseId: expense.id, expenseTitle: e.title,
        userId: c.userId, amount: c.amount, requestedById: e.actorId,
      };
      if (c.userId === e.actorId) {
        await tx.expenseContribution.create({ data: { ...base, status: "PENDING" } });
        result.pending += 1;
        continue;
      }
      await tx.expenseContribution.create({ data: { ...base, status: "APPROVED", reviewedAt: new Date() } });
      const r = await depositAndApplyIn(tx, {
        societyId: e.societyId, userId: c.userId, actorId: e.actorId, amount: c.amount,
        type: "EXPENSE_CREDIT", expenseId: expense.id, note: `Paid for: ${e.title}`,
      });
      result.credited.push({ userId: c.userId, amount: c.amount });
      result.applied.push(...r.applied);
    }
    return result;
  });
}

export type DeleteResult =
  | { ok: true; reversed: number; cancelled: number }
  | { ok: false; reason: "NOT_FOUND" }
  | { ok: false; reason: "CREDIT_USED"; userId: string };

/**
 * Delete an expense. Credit already granted for it is taken back, which only works while the
 * member still holds that much unspent credit; otherwise nothing changes.
 */
export async function deleteExpenseWithContributions(
  societyId: string,
  expenseId: string,
  actorId: string
): Promise<DeleteResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findFirst({ where: { id: expenseId, societyId }, select: { id: true, title: true } });
      if (!expense) return { ok: false as const, reason: "NOT_FOUND" as const };

      const contributions = await tx.expenseContribution.findMany({
        where: { expenseId, societyId, status: { in: ["APPROVED", "PENDING"] } },
        select: { id: true, userId: true, amount: true, status: true },
        orderBy: { userId: "asc" },
      });

      let reversed = 0;
      let cancelled = 0;
      for (const c of contributions) {
        if (c.status === "APPROVED") {
          await reverseExpenseCreditIn(tx, {
            societyId, userId: c.userId, amount: Number(c.amount), expenseId, actorId,
            note: `Expense deleted: ${expense.title}`,
          });
          await tx.expenseContribution.update({ where: { id: c.id }, data: { status: "REVERSED", reviewedById: actorId, reviewedAt: new Date() } });
          reversed += 1;
        } else {
          await tx.expenseContribution.update({ where: { id: c.id }, data: { status: "CANCELLED", reviewedById: actorId, reviewedAt: new Date() } });
          cancelled += 1;
        }
      }

      await tx.expense.deleteMany({ where: { id: expenseId, societyId } });
      return { ok: true as const, reversed, cancelled };
    });
  } catch (err) {
    if (err instanceof InsufficientCreditError) return { ok: false, reason: "CREDIT_USED", userId: err.userId };
    throw err;
  }
}
