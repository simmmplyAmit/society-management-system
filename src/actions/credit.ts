"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { depositAndApply } from "@/lib/ledger";
import { notifyApplied } from "@/lib/credit-service";
import { normalizeUtr } from "@/lib/utils/utr";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const MAX_AMOUNT = 1_000_000;

const depositSchema = z.object({
  userId: z.string().min(1, "Choose a member"),
  amount: z.coerce.number().positive("Enter the amount received").max(MAX_AMOUNT, "That amount is too large"),
  reference: z.string().trim().optional(),
  paidOn: z.string().optional(),
  note: z.string().trim().max(200).optional(),
});

/**
 * Treasurer/admin records money received directly from a member (cash, cheque, UPI) for any
 * amount. It becomes the member's credit and is applied to their dues, oldest first.
 */
export async function recordDeposit(formData: FormData) {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId!;

  const parsed = depositSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { userId, amount, note } = parsed.data;

  let reference: string | null = null;
  if (parsed.data.reference) {
    reference = normalizeUtr(parsed.data.reference);
    if (!reference) return { error: "The reference must be 8–22 letters or digits, or leave it empty" };
    const dup = await prisma.creditEntry.findFirst({
      where: { societyId, reference, type: "DEPOSIT" },
      select: { id: true },
    });
    const dupClaim = await prisma.paymentClaim.findFirst({
      where: { societyId, utrNumber: reference, status: { in: ["SUBMITTED", "APPROVED"] } },
      select: { id: true },
    });
    if (dup || dupClaim) return { error: "This reference has already been used" };
  }

  const paidOn = parsed.data.paidOn ? new Date(parsed.data.paidOn) : new Date();
  if (Number.isNaN(paidOn.getTime())) return { error: "Enter a valid date" };

  // The member must belong to this society and be linked to at least one flat
  const member = await prisma.user.findFirst({
    where: { id: userId, societyId, isActive: true, flatResidents: { some: {} } },
    select: { id: true },
  });
  if (!member) return { error: "Member not found in this society" };

  try {
    const { applied, balance } = await depositAndApply({
      societyId, userId: member.id, actorId: session.user.id, amount,
      reference, paidOn, note: note || "Recorded by committee",
    });
    await notifyApplied(societyId, applied);

    revalidatePath("/dashboard/maintenance");
    return { success: true as const, applied: applied.length, balance };
  } catch (err) {
    console.error("[recordDeposit] failed:", err);
    return { error: "Could not record the payment. Please try again" };
  }
}
