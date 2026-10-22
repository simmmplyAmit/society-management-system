"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { resolveBankAccountId } from "@/lib/queries/bank";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const MAX_AMOUNT = 10_000_000;

const incomeSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(120),
  category: z.string().trim().min(1, "Select a category").max(60),
  amount: z.coerce.number().positive("Amount must be positive").max(MAX_AMOUNT, "That amount is too large"),
  date: z.string().min(1, "Date is required"),
  description: z.string().trim().max(500).optional(),
  reference: z.string().trim().max(100).optional(),
  channel: z.enum(["BANK", "CASH"]).default("BANK"),
});

function paths() {
  revalidatePath("/dashboard/income");
  revalidatePath("/dashboard/bank");
  revalidatePath("/dashboard/income/statement");
  revalidatePath("/dashboard");
}

export async function addIncome(formData: FormData) {
  const session = await requireRole(["TREASURER", "ADMIN"]);
  const societyId = session.user.societyId!;

  const parsed = incomeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const date = new Date(parsed.data.date);
  if (Number.isNaN(date.getTime())) return { error: "Enter a valid date" };

  const account = parsed.data.channel === "CASH" ? { id: null } : await resolveBankAccountId(societyId, formData.get("bankAccountId"));
  if ("error" in account) return { error: account.error };

  await prisma.income.create({
    data: {
      societyId,
      receivedVia: parsed.data.channel,
      bankAccountId: account.id,
      title: parsed.data.title,
      category: parsed.data.category,
      amount: parsed.data.amount,
      date,
      description: parsed.data.description || null,
      reference: parsed.data.reference || null,
      addedById: session.user.id,
    },
  });
  paths();
  return { success: true as const };
}

export async function updateIncome(incomeId: string, formData: FormData) {
  const session = await requireRole(["TREASURER", "ADMIN"]);
  const societyId = session.user.societyId!;

  const parsed = incomeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const date = new Date(parsed.data.date);
  if (Number.isNaN(date.getTime())) return { error: "Enter a valid date" };

  const account = parsed.data.channel === "CASH" ? { id: null } : await resolveBankAccountId(societyId, formData.get("bankAccountId"));
  if ("error" in account) return { error: account.error };

  const { count } = await prisma.income.updateMany({
    where: { id: incomeId, societyId },
    data: {
      title: parsed.data.title,
      category: parsed.data.category,
      amount: parsed.data.amount,
      date,
      description: parsed.data.description || null,
      reference: parsed.data.reference || null,
      receivedVia: parsed.data.channel,
      bankAccountId: account.id,
    },
  });
  if (count === 0) return { error: "Income entry not found" };
  paths();
  return { success: true as const };
}

export async function deleteIncome(incomeId: string) {
  const session = await requireRole(["TREASURER", "ADMIN"]);
  const societyId = session.user.societyId!;

  await prisma.income.deleteMany({ where: { id: incomeId, societyId } });
  paths();
  return { success: true as const, error: undefined };
}
