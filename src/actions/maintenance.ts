"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { toIdx, periodsOverlap } from "@/lib/utils/maintenance";
import { generateForMonth } from "@/lib/queries/maintenance";
import { notifyPayments } from "@/lib/notify/dispatch";
import { sendNewDueNotices } from "@/lib/notify/schedule";
import { previousMonth } from "@/lib/utils/maintenance";

// ─────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────

const MIN_YEAR = 2000;

const chargeSchema = z.object({
  flatIds: z.array(z.string().min(1)).min(1, "Select at least one flat"),
  amount: z.coerce.number().positive("Amount must be positive"),
  startMonth: z.coerce.number().int().min(1).max(12),
  startYear: z.coerce.number().int().min(MIN_YEAR),
  endMonth: z.coerce.number().int().min(1).max(12).optional(),
  endYear: z.coerce.number().int().min(MIN_YEAR).optional(),
  description: z.string().optional(),
}).refine(
  (d) => {
    if (d.endMonth !== undefined && d.endYear !== undefined) {
      return toIdx(d.endMonth, d.endYear) >= toIdx(d.startMonth, d.startYear);
    }
    return true;
  },
  { message: "End date must be after start date" }
);

const generateSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(MIN_YEAR),
});

const bulkGenerateSchema = z.object({
  fromMonth: z.coerce.number().int().min(1).max(12),
  fromYear: z.coerce.number().int().min(MIN_YEAR),
  toMonth: z.coerce.number().int().min(1).max(12),
  toYear: z.coerce.number().int().min(MIN_YEAR),
  flatId: z.string().optional(), // empty = entire society
}).refine(
  (d) => toIdx(d.toMonth, d.toYear) >= toIdx(d.fromMonth, d.fromYear),
  { message: "End month must be after start month" }
);

const markPaidSchema = z.object({
  paymentId: z.string().min(1),
  utrNumber: z.string().optional(),
  notes: z.string().optional(),
  paidAt: z.string().optional(),
});

// ─────────────────────────────────────────────
// Set maintenance charge — with overlap check
// ─────────────────────────────────────────────

export async function setMaintenanceCharge(formData: FormData) {
  const session = await requireRole(["ADMIN"]);
  const societyId = session.user.societyId!;

  const raw = {
    // One or more flats can be submitted at once; duplicates are ignored
    flatIds: [...new Set(formData.getAll("flatId").map(String).filter(Boolean))],
    amount: formData.get("amount"),
    startMonth: formData.get("startMonth"),
    startYear: formData.get("startYear"),
    endMonth: formData.get("endMonth") || undefined,
    endYear: formData.get("endYear") || undefined,
    description: formData.get("description") || undefined,
  };

  const parsed = chargeSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { flatIds, startMonth, startYear, endMonth, endYear } = parsed.data;

  // Every flat must belong to the caller's society
  const flats = await prisma.flat.findMany({
    where: { id: { in: flatIds }, societyId },
    select: { id: true, number: true },
  });
  if (flats.length !== flatIds.length) return { error: "Flat not found" };

  // ── Overlap check (all-or-nothing across the selected flats) ──
  const existing = await prisma.maintenanceCharge.findMany({
    where: { flatId: { in: flatIds }, societyId },
  });

  const newStart = toIdx(startMonth, startYear);
  const newEnd = endMonth !== undefined && endYear !== undefined
    ? toIdx(endMonth, endYear)
    : null;

  for (const charge of existing) {
    const flat = flats.find((f) => f.id === charge.flatId);
    const exStart = toIdx(charge.startMonth, charge.startYear);
    const exEnd = charge.endMonth !== null && charge.endYear !== null
      ? toIdx(charge.endMonth, charge.endYear)
      : null;

    if (periodsOverlap(newStart, newEnd, exStart, exEnd)) {
      const label = charge.endMonth
        ? `${charge.startMonth}/${charge.startYear}–${charge.endMonth}/${charge.endYear}`
        : `${charge.startMonth}/${charge.startYear} (ongoing)`;
      return {
        error: `Overlaps with an existing charge${flat ? ` on flat ${flat.number}` : ""} (₹${charge.amount}/mo, ${label}). Close or delete it first — no charges were set.`,
      };
    }
  }
  // ──────────────────────────────────────────

  await prisma.maintenanceCharge.createMany({
    data: flatIds.map((flatId) => ({
      societyId,
      flatId,
      amount: parsed.data.amount,
      startMonth,
      startYear,
      endMonth: endMonth ?? null,
      endYear: endYear ?? null,
      description: parsed.data.description,
    })),
  });

  revalidatePath("/dashboard/maintenance");
  return { success: true as const, created: flatIds.length };
}

export async function deleteMaintenanceCharge(chargeId: string) {
  const session = await requireRole(["ADMIN"]);
  const societyId = session.user.societyId!;

  await prisma.maintenanceCharge.deleteMany({
    where: { id: chargeId, societyId },
  });

  revalidatePath("/dashboard/maintenance");
  return { success: true as const, error: undefined };
}

// ─────────────────────────────────────────────
// Generate for a single month (existing action)
// ─────────────────────────────────────────────

export async function generateMonthlyPayments(formData: FormData) {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId!;

  const parsed = generateSchema.safeParse({
    month: formData.get("month"),
    year: formData.get("year"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const result = await generateForMonth(societyId, parsed.data.month, parsed.data.year);

  if (result.created === 0 && result.skipped === 0) {
    return { error: "No active maintenance charges found for this month" };
  }

  // Announce the new dues, but only for the current/previous month (never a back-fill)
  let notified: { sent: number; failed: number; skipped: number } | undefined;
  if (formData.get("notify") === "on" && result.created > 0) {
    const now = new Date();
    const prev = previousMonth(now.getMonth() + 1, now.getFullYear());
    const { month, year } = parsed.data;
    const recent =
      (month === now.getMonth() + 1 && year === now.getFullYear()) ||
      (month === prev.month && year === prev.year);
    if (recent) {
      try {
        notified = await sendNewDueNotices({ societyId });
      } catch (err) {
        console.error("[generateMonthlyPayments] notify failed:", err);
      }
    }
  }

  revalidatePath("/dashboard/maintenance");
  return { success: true, ...result, notified };
}

// ─────────────────────────────────────────────
// Bulk scheduler — generate over a date range
// Optionally scoped to a single flat
// ─────────────────────────────────────────────

export async function generateDuesForRange(formData: FormData) {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId!;

  const raw = {
    fromMonth: formData.get("fromMonth"),
    fromYear: formData.get("fromYear"),
    toMonth: formData.get("toMonth"),
    toYear: formData.get("toYear"),
    flatId: formData.get("flatId") || undefined,
  };

  const parsed = bulkGenerateSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { fromMonth, fromYear, toMonth, toYear, flatId } = parsed.data;

  // Build list of all month/year combinations in the range
  const months: { month: number; year: number }[] = [];
  let m = fromMonth, y = fromYear;
  while (toIdx(m, y) <= toIdx(toMonth, toYear)) {
    months.push({ month: m, year: y });
    if (m === 12) { m = 1; y++; } else { m++; }
  }

  if (months.length > 120) {
    return { error: "Range too large — maximum 120 months (10 years)" };
  }

  let totalCreated = 0;
  let totalSkipped = 0;
  const log: { label: string; created: number; skipped: number }[] = [];

  for (const { month, year } of months) {
    const result = await generateForMonth(societyId, month, year, flatId);
    totalCreated += result.created;
    totalSkipped += result.skipped;
    if (result.created > 0 || result.skipped > 0) {
      log.push({
        label: `${String(month).padStart(2, "0")}/${year}`,
        created: result.created,
        skipped: result.skipped,
      });
    }
  }

  revalidatePath("/dashboard/maintenance");
  return {
    success: true,
    totalCreated,
    totalSkipped,
    monthsProcessed: months.length,
    log,
  };
}

// ─────────────────────────────────────────────
// Mark paid / pending
// ─────────────────────────────────────────────

export async function markPaymentPaid(formData: FormData) {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId!;

  const parsed = markPaidSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const payment = await prisma.maintenancePayment.findFirst({
    where: { id: parsed.data.paymentId, societyId },
  });
  if (!payment) return { error: "Payment not found" };

  const paidAt = parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date();
  await prisma.maintenancePayment.update({
    where: { id: parsed.data.paymentId },
    data: {
      status: "PAID",
      paidAt,
      paidBy: session.user.id,
      utrNumber: parsed.data.utrNumber || null,
      notes: parsed.data.notes || null,
    },
  });

  // Receipt to the residents; a messaging failure must not undo the payment
  try {
    await notifyPayments(
      "PAYMENT_RECEIPT",
      [{ paymentId: payment.id, keySuffix: String(paidAt.getTime()) }],
      societyId
    );
  } catch (err) {
    console.error("[markPaymentPaid] receipt failed:", err);
  }

  revalidatePath("/dashboard/maintenance");
  return { success: true };
}

export async function markPaymentPending(paymentId: string) {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId!;

  await prisma.maintenancePayment.updateMany({
    where: { id: paymentId, societyId },
    data: { status: "PENDING", paidAt: null, paidBy: null, utrNumber: null },
  });

  revalidatePath("/dashboard/maintenance");
  return { success: true as const, error: undefined };
}
