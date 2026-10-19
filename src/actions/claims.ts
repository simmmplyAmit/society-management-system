"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { depositAndApply } from "@/lib/ledger";
import { notifyApplied } from "@/lib/credit-service";
import { normalizeUtr } from "@/lib/utils/utr";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const MAX_DUES_PER_CLAIM = 36;
const MAX_OPEN_CLAIMS = 10;
const MAX_AGE_DAYS = 90;
const MAX_AMOUNT = 1_000_000; // ₹10 lakh per report; the treasurer checks it against the bank anyway
const UNPAID = ["PENDING", "OVERDUE"] as const;

const submitSchema = z.object({
  utrNumber: z.string().transform((v, ctx) => {
    const utr = normalizeUtr(v);
    if (!utr) ctx.addIssue({ code: "custom", message: "Enter the UPI reference (UTR), 8–22 letters or digits" });
    return utr ?? "";
  }),
  paidOn: z.string().optional(),
  // What the resident actually paid. Optional for older clients: defaults to the selected dues' balance.
  amount: z
    .union([z.literal(""), z.coerce.number().positive("Enter the amount you paid").max(MAX_AMOUNT, "That amount is too large")])
    .optional(),
});

/** Resident reports that they paid the selected dues. A treasurer verifies it later. */
export async function submitPaymentClaim(formData: FormData) {
  // Any society member may report a payment for flats they are linked to (committee members can own flats too)
  const session = await requireRole(["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"]);
  const { id: userId, societyId } = session.user;
  if (!societyId) return { error: "No society found" };

  const parsed = submitSchema.safeParse({
    utrNumber: formData.get("utrNumber") ?? "",
    paidOn: formData.get("paidOn") || undefined,
    amount: formData.get("amount") ?? undefined,
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
  const [dupClaim, dupPayment, dupDeposit] = await Promise.all([
    prisma.paymentClaim.findFirst({
      where: { societyId, utrNumber, status: { in: ["SUBMITTED", "APPROVED"] } },
      select: { id: true },
    }),
    prisma.maintenancePayment.findFirst({ where: { societyId, utrNumber }, select: { id: true } }),
    prisma.creditEntry.findFirst({ where: { societyId, reference: utrNumber, type: "DEPOSIT" }, select: { id: true } }),
  ]);
  if (dupClaim || dupPayment || dupDeposit) return { error: "This reference has already been used" };

  // Only the resident's own, unpaid dues that aren't already under review
  const dues = await prisma.maintenancePayment.findMany({
    where: {
      id: { in: ids },
      societyId,
      status: { in: [...UNPAID] },
      claimId: null,
      flat: { residents: { some: { userId } } },
    },
    select: { id: true, amount: true, amountPaid: true },
  });
  if (dues.length !== ids.length) return { error: "Some selected dues are no longer available" };

  // The resident may pay any amount (part-payment or advance); the treasurer confirms it against the bank
  const balance = dues.reduce((sum, d) => sum + Number(d.amount) - Number(d.amountPaid), 0);
  const declared = parsed.data.amount;
  const amount = typeof declared === "number" ? declared : balance;
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

const approveSchema = z.object({
  claimId: z.string().min(1),
  receivedAmount: z.number().positive("Enter the amount received").max(MAX_AMOUNT, "That amount is too large").optional(),
});

/**
 * Treasurer/admin confirms the money arrived. The amount becomes the resident's credit and is
 * applied to their dues straight away (the dues they chose first, then the oldest). A part-payment
 * leaves the rest of the due open; extra stays as credit for future dues.
 */
export async function approveClaim(claimId: string, receivedAmount?: number) {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId!;

  const parsedInput = approveSchema.safeParse({ claimId, receivedAmount });
  if (!parsedInput.success) return { error: parsedInput.error.issues[0].message };

  const claim = await prisma.paymentClaim.findFirst({
    where: { id: claimId, societyId, status: "SUBMITTED" },
    select: { id: true, userId: true, utrNumber: true, paidOn: true, amount: true },
  });
  if (!claim) return { error: "This report was already reviewed" };

  const reported = Number(claim.amount);
  const amount = receivedAmount ?? reported;
  const note = amount !== reported ? `Received ${amount} (reported ${reported})` : null;

  // Claim the review first so two approvers can't both process it
  const taken = await prisma.paymentClaim.updateMany({
    where: { id: claim.id, societyId, status: "SUBMITTED" },
    data: { status: "APPROVED", reviewedById: session.user.id, reviewedAt: new Date(), reviewNote: note },
  });
  if (taken.count !== 1) return { error: "This report was already reviewed" };

  const linked = await prisma.maintenancePayment.findMany({
    where: { claimId: claim.id, societyId },
    select: { id: true },
  });
  const priorityIds = linked.map((p) => p.id);

  try {
    const { applied, balance } = await depositAndApply({
      societyId, userId: claim.userId, actorId: session.user.id, amount,
      claimId: claim.id, reference: claim.utrNumber, paidOn: claim.paidOn, priorityIds,
      note: note ?? "Payment report approved",
    });
    // The report is settled; its dues are free to be reported again if still unpaid
    await prisma.maintenancePayment.updateMany({ where: { claimId: claim.id, societyId }, data: { claimId: null } });
    await notifyApplied(societyId, applied);

    revalidatePath("/dashboard/maintenance");
    return { success: true as const, applied: applied.length, paidInFull: applied.filter((a) => a.fullyPaid).length, balance };
  } catch (err) {
    console.error("[approveClaim] ledger failed:", err);
    // Nothing was credited: put the report back so it can be approved again
    await prisma.paymentClaim.updateMany({
      where: { id: claim.id, societyId, status: "APPROVED" },
      data: { status: "SUBMITTED", reviewedById: null, reviewedAt: null, reviewNote: null },
    });
    return { error: "Could not record the payment. Please try again" };
  }
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
