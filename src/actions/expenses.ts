"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { createExpenseWithContributions, deleteExpenseWithContributions } from "@/lib/expense-contributions";
import { notifyApplied } from "@/lib/credit-service";
import { notifyExpenseCredit } from "@/lib/notify/expense-credit";
import { resolveBankAccountId } from "@/lib/queries/bank";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const MAX_CONTRIBUTORS = 20;
const MAX_AMOUNT = 10_000_000;

const expenseSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  category: z.string().min(1, "Select a category"),
  amount: z.coerce.number().positive("Amount must be positive").max(MAX_AMOUNT, "That amount is too large"),
  date: z.string().min(1, "Date is required"),
  description: z.string().optional(),
  channel: z.enum(["BANK", "CASH"]).default("BANK"),
  receiptUrl: z
    .string()
    .trim()
    .max(500, "Receipt link is too long")
    .refine((v) => v === "" || /^https:\/\/\S+$/i.test(v), "Receipt link must start with https://")
    .optional(),
});

const contributionsSchema = z
  .array(
    z.object({
      userId: z.string().min(1),
      amount: z.number().positive("Each member's amount must be positive").max(MAX_AMOUNT),
    })
  )
  .max(MAX_CONTRIBUTORS, `At most ${MAX_CONTRIBUTORS} members per expense`);

const paise = (n: number) => Math.round(n * 100);

function paths() {
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/bank");
  revalidatePath("/dashboard/maintenance");
}

export async function addExpense(formData: FormData) {
  const session = await requireRole(["TREASURER", "ADMIN"]);
  const societyId = session.user.societyId!;

  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Advanced: members who paid some or all of this expense themselves
  let contributions: z.infer<typeof contributionsSchema> = [];
  const rawContributions = formData.get("contributions");
  if (typeof rawContributions === "string" && rawContributions.trim() !== "") {
    let json: unknown;
    try {
      json = JSON.parse(rawContributions);
    } catch {
      return { error: "Invalid member payments" };
    }
    const c = contributionsSchema.safeParse(json);
    if (!c.success) return { error: c.error.issues[0].message };
    contributions = c.data;
  }

  const account = parsed.data.channel === "CASH" ? { id: null } : await resolveBankAccountId(societyId, formData.get("bankAccountId"));
  if ("error" in account) return { error: account.error };

  const base = {
    societyId,
    paidVia: parsed.data.channel,
    bankAccountId: account.id,
    title: parsed.data.title,
    category: parsed.data.category,
    amount: parsed.data.amount,
    date: new Date(parsed.data.date),
    description: parsed.data.description || null,
    receiptUrl: parsed.data.receiptUrl || null,
  };

  if (contributions.length === 0) {
    await prisma.expense.create({ data: { ...base, addedById: session.user.id } });
    paths();
    return { success: true };
  }

  const ids = contributions.map((c) => c.userId);
  if (new Set(ids).size !== ids.length) return { error: "Each member can only be listed once" };
  if (contributions.reduce((n, c) => n + paise(c.amount), 0) > paise(parsed.data.amount)) {
    return { error: "Members' amounts can't add up to more than the expense" };
  }

  // Only active members of this society who are linked to a flat can be credited
  const members = await prisma.user.findMany({
    where: { id: { in: ids }, societyId, isActive: true, flatResidents: { some: {} } },
    select: { id: true },
  });
  if (members.length !== ids.length) return { error: "Choose members who live in this society" };

  try {
    const r = await createExpenseWithContributions({ ...base, actorId: session.user.id }, contributions);
    await notifyApplied(societyId, r.applied);
    await notifyExpenseCredit(societyId, r.credited.map((c) => ({ ...c, expenseTitle: base.title })));
    paths();
    return { success: true, credited: r.credited.length, pendingApproval: r.pending };
  } catch (err) {
    console.error("[addExpense] failed:", err);
    return { error: "Could not save the expense. Please try again" };
  }
}

export async function deleteExpense(expenseId: string) {
  const session = await requireRole(["TREASURER", "ADMIN"]);
  const societyId = session.user.societyId!;

  const linked = await prisma.expenseContribution.count({
    where: { expenseId, societyId, status: { in: ["APPROVED", "PENDING"] } },
  });

  if (linked === 0) {
    await prisma.expense.deleteMany({ where: { id: expenseId, societyId } });
    paths();
    return { success: true as const, error: undefined };
  }

  // Credit was granted for this expense: take it back with it, but only if it is still unspent
  const r = await deleteExpenseWithContributions(societyId, expenseId, session.user.id);
  if (!r.ok) {
    return {
      error:
        r.reason === "CREDIT_USED"
          ? "A member has already used the credit from this expense, so it can't be deleted here"
          : "Expense not found",
    };
  }
  paths();
  return { success: true as const, error: undefined };
}
