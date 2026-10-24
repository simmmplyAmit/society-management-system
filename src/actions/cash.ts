"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { depositAndApply } from "@/lib/ledger";
import { notifyApplied } from "@/lib/credit-service";
import { resolveBankAccountId } from "@/lib/queries/bank";
import { z } from "zod";
import { revalidatePath } from "next/cache";

// Cash handling. A committee member (ADMIN/TREASURER) takes cash from a resident: a numbered
// receipt is issued and the resident's credit is topped up at once (and applied to their dues).
// The cash then counts as "in hand" with that member until it is banked in a CashDeposit.

const MAX_AMOUNT = 1_000_000;
const MAX_COLLECTIONS_PER_DEPOSIT = 200;
const MAX_AGE_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

function paths() {
  revalidatePath("/dashboard/maintenance");
}

function parseDate(value: string | undefined, now: Date): Date | { error: string } {
  const d = value ? new Date(value) : now;
  if (Number.isNaN(d.getTime())) return { error: "Enter a valid date" };
  if (d.getTime() > now.getTime() + DAY_MS) return { error: "The date cannot be in the future" };
  if (now.getTime() - d.getTime() > MAX_AGE_DAYS * DAY_MS) return { error: `The date must be within the last ${MAX_AGE_DAYS} days` };
  return d;
}

const collectSchema = z.object({
  userId: z.string().min(1, "Choose a member"),
  amount: z.coerce.number().positive("Enter the amount received").max(MAX_AMOUNT, "That amount is too large"),
  receivedOn: z.string().optional(),
  note: z.string().trim().max(200).optional(),
});

export async function collectCash(formData: FormData) {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId!;
  const collectorId = session.user.id;

  const parsed = collectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { userId, amount, note } = parsed.data;

  const receivedOn = parseDate(parsed.data.receivedOn, new Date());
  if ("error" in receivedOn) return receivedOn;

  const member = await prisma.user.findFirst({
    where: { id: userId, societyId, isActive: true, flatResidents: { some: {} } },
    select: { id: true },
  });
  if (!member) return { error: "Member not found in this society" };

  let receiptNo = 0;
  try {
    const { applied, balance } = await depositAndApply({
      societyId, userId: member.id, actorId: collectorId, amount, paidOn: receivedOn,
      note: "Cash received", channel: "CASH",
      // Receipt number, collection record and credit all commit together or not at all
      inTx: async (tx) => {
        const seq = await tx.society.update({
          where: { id: societyId },
          data: { cashReceiptSeq: { increment: 1 } },
          select: { cashReceiptSeq: true },
        });
        receiptNo = seq.cashReceiptSeq;
        await tx.cashCollection.create({
          data: {
            societyId, receiptNo, userId: member.id, collectedById: collectorId,
            amount, receivedOn, note: note || null,
          },
        });
      },
    });
    await notifyApplied(societyId, applied);

    paths();
    return { success: true as const, receiptNo, applied: applied.length, balance };
  } catch (err) {
    console.error("[collectCash] failed:", err);
    return { error: "Could not record the cash. Please try again" };
  }
}

const depositSchema = z.object({
  reference: z.string().trim().min(4, "Enter the bank slip number or reference").max(40, "Reference is too long"),
  depositedOn: z.string().optional(),
  note: z.string().trim().max(200).optional(),
});

/** Bank the selected cash. The amount is the sum of the collections, never taken from the form. */
export async function depositCash(formData: FormData) {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId!;

  const parsed = depositSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { reference, note } = parsed.data;

  const ids = [...new Set(formData.getAll("collectionId").map(String).filter(Boolean))];
  if (ids.length === 0) return { error: "Select the cash you deposited" };
  if (ids.length > MAX_COLLECTIONS_PER_DEPOSIT) return { error: `Select at most ${MAX_COLLECTIONS_PER_DEPOSIT} receipts at a time` };

  const depositedOn = parseDate(parsed.data.depositedOn, new Date());
  if ("error" in depositedOn) return depositedOn;

  const account = await resolveBankAccountId(societyId, formData.get("bankAccountId"));
  if ("error" in account) return { error: account.error };

  const dup = await prisma.cashDeposit.findFirst({ where: { societyId, reference }, select: { id: true } });
  if (dup) return { error: "This bank reference has already been used for a deposit" };

  const collections = await prisma.cashCollection.findMany({
    where: { id: { in: ids }, societyId, depositId: null },
    select: { id: true, amount: true, receivedOn: true },
  });
  if (collections.length !== ids.length) return { error: "Some of that cash was already deposited" };
  if (collections.some((c) => c.receivedOn.getTime() > depositedOn.getTime() + DAY_MS)) {
    return { error: "A deposit cannot be dated before the cash was received" };
  }

  const total = Math.round(collections.reduce((n, c) => n + Number(c.amount) * 100, 0)) / 100;

  try {
    await prisma.$transaction(async (tx) => {
      const deposit = await tx.cashDeposit.create({
        data: { societyId, depositedById: session.user.id, amount: total, depositedOn, reference, note: note || null, bankAccountId: account.id },
        select: { id: true },
      });
      // Guarded attach: if anyone banked one of these in the meantime, everything rolls back
      const attached = await tx.cashCollection.updateMany({
        where: { id: { in: ids }, societyId, depositId: null },
        data: { depositId: deposit.id },
      });
      if (attached.count !== ids.length) throw new Error("ALREADY_DEPOSITED");
    });
  } catch (err) {
    if (err instanceof Error && err.message === "ALREADY_DEPOSITED") return { error: "Some of that cash was already deposited" };
    console.error("[depositCash] failed:", err);
    return { error: "Could not record the deposit. Please try again" };
  }

  paths();
  return { success: true as const, amount: total, count: ids.length };
}

/** A different admin/treasurer confirms the deposit appears on the bank statement. */
export async function confirmCashDeposit(depositId: string) {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId!;

  const deposit = await prisma.cashDeposit.findFirst({
    where: { id: depositId, societyId, confirmedAt: null },
    select: { id: true, depositedById: true },
  });
  if (!deposit) return { error: "Deposit not found or already confirmed" };
  if (deposit.depositedById === session.user.id) return { error: "Someone else must confirm your deposit" };

  const r = await prisma.cashDeposit.updateMany({
    where: { id: deposit.id, societyId, confirmedAt: null },
    data: { confirmedById: session.user.id, confirmedAt: new Date() },
  });
  if (r.count !== 1) return { error: "Deposit not found or already confirmed" };

  paths();
  return { success: true as const };
}
