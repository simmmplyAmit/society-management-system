"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { notifyPayments } from "@/lib/notify/dispatch";
import { normalizeUtr } from "@/lib/utils/utr";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const MAX_DUES_PER_CLAIM = 36;
const MAX_OPEN_CLAIMS = 10;
const MAX_AGE_DAYS = 90;
const UNPAID = ["PENDING", "OVERDUE"] as const;

const submitSchema = z.object({
  utrNumber: z.string().transform((v, ctx) => {
    const utr = normalizeUtr(v);
    if (!utr) ctx.addIssue({ code: "custom", message: "Enter the UPI reference (UTR), 8–22 letters or digits" });
    return utr ?? "";
  }),
  paidOn: z.string().optional(),
});

/** Resident reports that they paid the selected dues. A treasurer verifies it later. */
export async function submitPaymentClaim(formData: FormData) {
  const session = await requireRole(["OWNER", "TENANT"]);
  const { id: userId, societyId } = session.user;
  if (!societyId) return { error: "No society found" };

  const parsed = submitSchema.safeParse({
    utrNumber: formData.get("utrNumber") ?? "",
    paidOn: formData.get("paidOn") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { utrNumber } = parsed.data;

  const ids = [...new Set(formData.getAll("paymentId").map(String).filter(Boolean))];
  if (ids.length === 0) return { error: "Select at least one due" };
  if (ids.length > MAX_DUES_PER_CLAIM) return { error: `Select at most ${MAX_DUES_PER_CLAIM} dues at a time` };

  const now = new Date();
  const paidOn = parsed.data.paidOn ? new Date(parsed.data.paidOn) : now;
  if (Number.isNaN(paidOn.getTime())) return { error: "Enter a valid payment date" };
  if (paidOn.getTime() > now.getTime() + 24 * 60 * 60 * 1000) return { error: "Payment date cannot be in the future" };
  if (now.getTime() - paidOn.getTime() > MAX_AGE_DAYS * 24 * 60 * 60 * 1000) {
    return { error: `Payment date must be within the last ${MAX_AGE_DAYS} days` };
  }

  const open = await prisma.paymentClaim.count({ where: { societyId, userId, status: "SUBMITTED" } });
  if (open >= MAX_OPEN_CLAIMS) return { error: "You have too many reports awaiting verification" };

  // The same reference can't be reported twice (rejected reports may be corrected and resent)
  const [dupClaim, dupPayment] = await Promise.all([
    prisma.paymentClaim.findFirst({
      where: { societyId, utrNumber, status: { in: ["SUBMITTED", "APPROVED"] } },
      select: { id: true },
    }),
    prisma.maintenancePayment.findFirst({ where: { societyId, utrNumber }, select: { id: true } }),
  ]);
  if (dupClaim || dupPayment) return { error: "This reference has already been used" };

  // Only the resident's own, unpaid dues that aren't already under review
  const dues = await prisma.maintenancePayment.findMany({
    where: {
      id: { in: ids },
      societyId,
      status: { in: [...UNPAID] },
      claimId: null,
      flat: { residents: { some: { userId } } },
    },
    select: { id: true, amount: true },
  });
  if (dues.length !== ids.length) return { error: "Some selected dues are no longer available" };

  const amount = dues.reduce((sum, d) => sum + Number(d.amount), 0); // never trust a client total
  const claim = await prisma.paymentClaim.create({
    data: { societyId, userId, utrNumber, amount, paidOn },
    select: { id: true },
  });

  // Guarded attach: if another request grabbed any due in the meantime, undo everything
  const attached = await prisma.maintenancePayment.updateMany({
    where: { id: { in: ids }, societyId, claimId: null, status: { in: [...UNPAID] } },
    data: { claimId: claim.id },
  });
  if (attached.count !== ids.length) {
    await prisma.maintenancePayment.updateMany({ where: { claimId: claim.id }, data: { claimId: null } });
    await prisma.paymentClaim.deleteMany({ where: { id: claim.id } });
    return { error: "Some selected dues are no longer available" };
  }

  revalidatePath("/dashboard/maintenance");
  return { success: true as const };
}

/** Treasurer/admin confirms the money arrived: marks every due in the report paid. */
export async function approveClaim(claimId: string) {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId!;

  const claim = await prisma.paymentClaim.findFirst({
    where: { id: claimId, societyId, status: "SUBMITTED" },
    select: { id: true, utrNumber: true, paidOn: true },
  });
  if (!claim) return { error: "This report was already reviewed" };

  // Claim the review first so two approvers can't both process it
  const taken = await prisma.paymentClaim.updateMany({
    where: { id: claim.id, societyId, status: "SUBMITTED" },
    data: { status: "APPROVED", reviewedById: session.user.id, reviewedAt: new Date() },
  });
  if (taken.count !== 1) return { error: "This report was already reviewed" };

  const toPay = await prisma.maintenancePayment.findMany({
    where: { claimId: claim.id, societyId, status: { not: "PAID" } },
    select: { id: true },
  });
  await prisma.maintenancePayment.updateMany({
    where: { id: { in: toPay.map((p) => p.id) }, societyId },
    data: { status: "PAID", paidAt: claim.paidOn, paidBy: session.user.id, utrNumber: claim.utrNumber },
  });

  try {
    await notifyPayments(
      "PAYMENT_RECEIPT",
      toPay.map((p) => ({ paymentId: p.id, keySuffix: String(claim.paidOn.getTime()) })),
      societyId
    );
  } catch (err) {
    console.error("[approveClaim] receipt failed:", err);
  }

  revalidatePath("/dashboard/maintenance");
  return { success: true as const, paid: toPay.length };
}

const rejectSchema = z.object({
  claimId: z.string().min(1),
  reason: z.string().trim().max(200).optional(),
});

/** Treasurer/admin could not find the payment: frees the dues so the resident can try again. */
export async function rejectClaim(formData: FormData) {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId!;

  const parsed = rejectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { claimId, reason } = parsed.data;

  const taken = await prisma.paymentClaim.updateMany({
    where: { id: claimId, societyId, status: "SUBMITTED" },
    data: {
      status: "REJECTED",
      reviewNote: reason || null,
      reviewedById: session.user.id,
      reviewedAt: new Date(),
    },
  });
  if (taken.count !== 1) return { error: "This report was already reviewed" };

  await prisma.maintenancePayment.updateMany({
    where: { claimId, societyId },
    data: { claimId: null },
  });

  revalidatePath("/dashboard/maintenance");
  return { success: true as const };
}
