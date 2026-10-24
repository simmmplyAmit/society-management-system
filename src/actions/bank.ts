"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getBankBalance } from "@/lib/queries/bank";
import { differenceOf } from "@/lib/utils/bank";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const MAX_BALANCE = 1_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

function paths() {
  revalidatePath("/dashboard/bank");
  revalidatePath("/dashboard/income");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard");
}

function parseDate(raw: string): Date | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

const accountSchema = z.object({
  name: z.string().trim().min(2, "Give the account a name").max(60),
  bankName: z.string().trim().max(60).optional(),
  last4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Enter the last 4 digits of the account number, or leave it empty")
    .optional()
    .or(z.literal("")),
  openingBalance: z.coerce.number().min(0, "The opening balance can't be negative").max(MAX_BALANCE, "That amount is too large"),
  openingDate: z.string().min(1, "Choose the opening date"),
});

/** Add a bank account. Everything dated before its opening date is ignored by the tally. */
export async function addBankAccount(formData: FormData) {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId!;

  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const openingDate = parseDate(parsed.data.openingDate);
  if (!openingDate) return { error: "Enter a valid date" };
  if (openingDate.getTime() > Date.now() + DAY_MS) return { error: "The opening date can't be in the future" };

  const last4 = parsed.data.last4 || null;
  if (last4) {
    const dup = await prisma.bankAccount.findFirst({
      where: { societyId, last4, bankName: parsed.data.bankName || null, isActive: true },
      select: { id: true },
    });
    if (dup) return { error: "This account is already added" };
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.bankAccount.count({ where: { societyId, isActive: true } });
    await tx.bankAccount.create({
      data: {
        societyId,
        name: parsed.data.name,
        bankName: parsed.data.bankName || null,
        last4,
        openingBalance: parsed.data.openingBalance,
        openingDate,
        isPrimary: existing === 0, // the first account receives everything not tagged
      },
    });
  });
  paths();
  return { success: true as const };
}

/** Choose the account that receives UPI payments and anything not tagged with an account. */
export async function setPrimaryBankAccount(accountId: string) {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId!;

  try {
    await prisma.$transaction(async (tx) => {
      const target = await tx.bankAccount.updateMany({
        where: { id: accountId, societyId, isActive: true },
        data: { isPrimary: true },
      });
      if (target.count !== 1) throw new Error("NOT_FOUND");
      await tx.bankAccount.updateMany({
        where: { societyId, id: { not: accountId }, isPrimary: true },
        data: { isPrimary: false },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") return { error: "Account not found" };
    console.error("[setPrimaryBankAccount] failed:", err);
    return { error: "Could not change the primary account" };
  }
  paths();
  return { success: true as const };
}

const checkSchema = z.object({
  bankAccountId: z.string().min(1, "Choose an account"),
  statementBalance: z.coerce.number().min(-MAX_BALANCE).max(MAX_BALANCE, "That amount is too large"),
  asOf: z.string().min(1, "Choose the statement date"),
  note: z.string().trim().max(200).optional(),
});

/**
 * Compare the balance on the bank statement with what the app expects for that date. The expected
 * figure is always computed here, never taken from the form, and the result is kept as a log.
 */
export async function recordBalanceCheck(formData: FormData) {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId!;

  const parsed = checkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const asOf = parseDate(parsed.data.asOf);
  if (!asOf) return { error: "Enter a valid date" };
  if (asOf.getTime() > Date.now() + DAY_MS) return { error: "The statement date can't be in the future" };

  const account = await prisma.bankAccount.findFirst({
    where: { id: parsed.data.bankAccountId, societyId, isActive: true },
  });
  if (!account) return { error: "Account not found" };
  if (asOf.getTime() < account.openingDate.getTime()) return { error: "That date is before the account's opening date" };

  const expected = (await getBankBalance(societyId, { ...account, openingBalance: Number(account.openingBalance) }, asOf)).expected;
  const difference = differenceOf(parsed.data.statementBalance, expected);

  await prisma.bankBalanceCheck.create({
    data: {
      societyId,
      bankAccountId: account.id,
      asOf,
      statementBalance: parsed.data.statementBalance,
      expectedBalance: expected,
      difference,
      note: parsed.data.note || null,
      recordedById: session.user.id,
    },
  });
  paths();
  return { success: true as const, expected, difference };
}
