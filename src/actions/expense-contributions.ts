"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { depositAndApply } from "@/lib/ledger";
import { notifyApplied } from "@/lib/credit-service";
import { notifyExpenseCredit } from "@/lib/notify/expense-credit";
import { z } from "zod";
import { revalidatePath } from "next/cache";

// A member credit the recorder created for themselves waits here for a different admin/treasurer.

function paths() {
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/maintenance");
}

export async function approveContribution(contributionId: string) {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId!;

  const c = await prisma.expenseContribution.findFirst({
    where: { id: contributionId, societyId, status: "PENDING" },
    select: { id: true, userId: true, amount: true, expenseId: true, expenseTitle: true, requestedById: true },
  });
  if (!c) return { error: "This request was already handled" };
  if (c.requestedById === session.user.id) return { error: "You can't approve credit for your own expense" };
  if (!c.expenseId) return { error: "The expense was deleted" };

  // Claim the decision first so two approvers can't both credit it
  const taken = await prisma.expenseContribution.updateMany({
    where: { id: c.id, societyId, status: "PENDING" },
    data: { status: "APPROVED", reviewedById: session.user.id, reviewedAt: new Date() },
  });
  if (taken.count !== 1) return { error: "This request was already handled" };

  try {
    const { applied } = await depositAndApply({
      societyId, userId: c.userId, actorId: session.user.id, amount: Number(c.amount),
      type: "EXPENSE_CREDIT", expenseId: c.expenseId, note: `Paid for: ${c.expenseTitle}`,
    });
    await notifyApplied(societyId, applied);
    await notifyExpenseCredit(societyId, [{ userId: c.userId, amount: Number(c.amount), expenseTitle: c.expenseTitle }]);
    paths();
    return { success: true as const };
  } catch (err) {
    console.error("[approveContribution] ledger failed:", err);
    await prisma.expenseContribution.updateMany({
      where: { id: c.id, societyId, status: "APPROVED" },
      data: { status: "PENDING", reviewedById: null, reviewedAt: null },
    });
    return { error: "Could not record the credit. Please try again" };
  }
}

const rejectSchema = z.object({
  contributionId: z.string().min(1),
  reason: z.string().trim().max(200).optional(),
});

export async function rejectContribution(formData: FormData) {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId!;

  const parsed = rejectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { contributionId, reason } = parsed.data;

  const c = await prisma.expenseContribution.findFirst({
    where: { id: contributionId, societyId, status: "PENDING" },
    select: { id: true, requestedById: true },
  });
  if (!c) return { error: "This request was already handled" };
  if (c.requestedById === session.user.id) return { error: "Use Withdraw for your own request" };

  const r = await prisma.expenseContribution.updateMany({
    where: { id: c.id, societyId, status: "PENDING" },
    data: { status: "REJECTED", note: reason || null, reviewedById: session.user.id, reviewedAt: new Date() },
  });
  if (r.count !== 1) return { error: "This request was already handled" };

  paths();
  return { success: true as const };
}

/** The person who recorded the expense can withdraw their own pending request. */
export async function cancelContribution(contributionId: string) {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId!;

  const r = await prisma.expenseContribution.updateMany({
    where: { id: contributionId, societyId, requestedById: session.user.id, status: "PENDING" },
    data: { status: "CANCELLED", reviewedAt: new Date(), note: "Withdrawn by requester" },
  });
  if (r.count !== 1) return { error: "No pending request of yours to withdraw" };

  paths();
  return { success: true as const };
}
