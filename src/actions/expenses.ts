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
