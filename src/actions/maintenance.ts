"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { z } from "zod";
import { revalidatePath } from "next/cache";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Convert month+year into a single integer for easy comparison */
export function toIdx(month: number, year: number) {
  return year * 12 + month;
}

/** Check whether two charge periods overlap.
 *  null endMonth/endYear means "open-ended" (ongoing). */
export function periodsOverlap(
  aStart: number, aEnd: number | null, // monthIdx
  bStart: number, bEnd: number | null
) {
  // a ends before b starts → no overlap
  if (aEnd !== null && aEnd < bStart) return false;
  // b ends before a starts → no overlap
  if (bEnd !== null && bEnd < aStart) return false;
  return true;
}

// ─────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────

const MIN_YEAR = 2000;

const chargeSchema = z.object({
  flatId: z.string().min(1, "Select a flat"),
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
    flatId: formData.get("flatId"),
    amount: formData.get("amount"),
    startMonth: formData.get("startMonth"),
    startYear: formData.get("startYear"),
    endMonth: formData.get("endMonth") || undefined,
    endYear: formData.get("endYear") || undefined,
    description: formData.get("description") || undefined,
  };

  const parsed = chargeSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { flatId, startMonth, startYear, endMonth, endYear } = parsed.data;

  const flat = await prisma.flat.findFirst({ where: { id: flatId, societyId } });
  if (!flat) return { error: "Flat not found" };

  // ── Overlap check ──────────────────────────
  const existing = await prisma.maintenanceCharge.findMany({
    where: { flatId, societyId },
  });

  const newStart = toIdx(startMonth, startYear);
  const newEnd = endMonth !== undefined && endYear !== undefined
    ? toIdx(endMonth, endYear)
    : null;

  for (const charge of existing) {
    const exStart = toIdx(charge.startMonth, charge.startYear);
    const exEnd = charge.endMonth !== null && charge.endYear !== null
      ? toIdx(charge.endMonth, charge.endYear)
      : null;

    if (periodsOverlap(newStart, newEnd, exStart, exEnd)) {
      const label = charge.endMonth
        ? `${charge.startMonth}/${charge.startYear}–${charge.endMonth}/${charge.endYear}`
        : `${charge.startMonth}/${charge.startYear} (ongoing)`;
      return {
        error: `Overlaps with an existing charge (₹${charge.amount}/mo, ${label}). Close or delete it first.`,
      };
    }
  }
  // ──────────────────────────────────────────

  await prisma.maintenanceCharge.create({
    data: {
      societyId,
      flatId,
      amount: parsed.data.amount,
      startMonth,
      startYear,
      endMonth: endMonth ?? null,
      endYear: endYear ?? null,
      description: parsed.data.description,
    },
  });

  revalidatePath("/dashboard/maintenance");
  return { success: true };
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
// Core generator — used by all generate actions
// Returns { created, skipped } for one month
// ─────────────────────────────────────────────

async function generateForMonth(
  societyId: string,
  month: number,
  year: number,
  flatId?: string // undefined = all flats
) {
  const chargeWhere: Record<string, unknown> = {
    societyId,
    startYear: { lte: year },
    OR: [
      { endYear: null },
      { endYear: { gt: year } },
      { endYear: year, endMonth: { gte: month } },
    ],
  };

  // Also filter by startMonth when startYear === year
  // (handled post-fetch to keep query simple)
  if (flatId) chargeWhere.flatId = flatId;

  const charges = await prisma.maintenanceCharge.findMany({
    where: chargeWhere,
  });

  // Filter out charges that haven't started yet in the same year
  const activeCharges = charges.filter((c) => {
    if (c.startYear === year && c.startMonth > month) return false;
    return true;
  });

  let created = 0;
  let skipped = 0;

  for (const charge of activeCharges) {
    const existing = await prisma.maintenancePayment.findUnique({
      where: { flatId_month_year: { flatId: charge.flatId, month, year } },
    });

    if (existing) { skipped++; continue; }

    await prisma.maintenancePayment.create({
      data: {
        societyId,
        flatId: charge.flatId,
        chargeId: charge.id,
        month,
        year,
        amount: charge.amount,
        status: "PENDING",
      },
    });
    created++;
  }

  return { created, skipped };
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

  revalidatePath("/dashboard/maintenance");
  return { success: true, ...result };
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
// Cron-safe generator — no session required
// Called by /api/cron/generate-maintenance
// ─────────────────────────────────────────────

export async function generateAllSocietiesCurrentMonth() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const societies = await prisma.society.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  const results: { society: string; created: number; skipped: number }[] = [];

  for (const society of societies) {
    const result = await generateForMonth(society.id, month, year);
    results.push({ society: society.name, ...result });
  }

  return { month, year, results };
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

  await prisma.maintenancePayment.update({
    where: { id: parsed.data.paymentId },
    data: {
      status: "PAID",
      paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date(),
      paidBy: session.user.id,
      utrNumber: parsed.data.utrNumber || null,
      notes: parsed.data.notes || null,
    },
  });

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

// ─────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────

export async function getMaintenanceCharges(societyId: string) {
  return prisma.maintenanceCharge.findMany({
    where: { societyId },
    include: {
      flat: {
        include: {
          floor: { include: { wing: { select: { name: true } } } },
        },
      },
    },
    orderBy: [
      { flat: { floor: { wing: { name: "asc" } } } },
      { flat: { floor: { number: "asc" } } },
      { flat: { number: "asc" } },
      { startYear: "desc" },
      { startMonth: "desc" },
    ],
  });
}

export async function getMonthlyPayments(
  societyId: string,
  month: number,
  year: number
) {
  return prisma.maintenancePayment.findMany({
    where: { societyId, month, year },
    include: {
      flat: {
        include: {
          floor: { include: { wing: { select: { name: true } } } },
          residents: {
            where: { isPrimary: true },
            include: { user: { select: { name: true, phone: true } } },
          },
        },
      },
    },
    orderBy: [
      { flat: { floor: { wing: { name: "asc" } } } },
      { flat: { floor: { number: "asc" } } },
      { flat: { number: "asc" } },
    ],
  });
}

export async function getResidentPayments(societyId: string, userId: string) {
  const flatResidents = await prisma.flatResident.findMany({
    where: { userId, flat: { societyId } },
    select: { flatId: true },
  });
  const flatIds = flatResidents.map((fr) => fr.flatId);

  return prisma.maintenancePayment.findMany({
    where: { flatId: { in: flatIds } },
    include: {
      flat: {
        include: {
          floor: { include: { wing: { select: { name: true } } } },
        },
      },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
}
