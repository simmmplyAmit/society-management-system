// Server-only maintenance data access. Deliberately NOT a "use server" file:
// exports here must never become client-callable endpoints. Callers must pass a
// societyId taken from the authenticated session (or, for the cron, loop all societies).
import { prisma } from "@/lib/prisma";
import type { MaintenanceStatus } from "@prisma/client";
import { previousMonth } from "@/lib/utils/maintenance";

// ─────────────────────────────────────────────
// Core generator — used by all generate actions
// Returns { created, skipped } for one month
// ─────────────────────────────────────────────

export async function generateForMonth(
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
      where: { flatId_month_year_chargeKey: { flatId: charge.flatId, month, year, chargeKey: "MAINTENANCE" } },
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
// Cron-safe generator — no session required
// Called by /api/cron/generate-maintenance
// ─────────────────────────────────────────────

export async function generateAllSocietiesCurrentMonth(now: Date = new Date()) {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const prev = previousMonth(month, year);

  const societies = await prisma.society.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  const results: { society: string; created: number; skipped: number }[] = [];

  for (const society of societies) {
    // Previous month is generated too, so a missed cron run is caught up (idempotent)
    const catchUp = await generateForMonth(society.id, prev.month, prev.year);
    const current = await generateForMonth(society.id, month, year);
    results.push({
      society: society.name,
      created: catchUp.created + current.created,
      skipped: catchUp.skipped + current.skipped,
    });
  }

  const overdueMarked = await markOverduePayments(now);

  return { month, year, results, overdueMarked };
}

/** Flip PENDING payments from before the current month to OVERDUE. Returns count updated. */
export async function markOverduePayments(now: Date = new Date()) {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const { count } = await prisma.maintenancePayment.updateMany({
    where: {
      status: "PENDING",
      society: { isActive: true },
      OR: [{ year: { lt: year } }, { year, month: { lt: month } }],
    },
    data: { status: "OVERDUE" },
  });
  return count;
}


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

export type PaymentStatusFilter = "unpaid" | "overdue" | "paid" | "all";

const STATUS_WHERE: Record<PaymentStatusFilter, MaintenanceStatus[] | undefined> = {
  unpaid: ["PENDING", "OVERDUE"],
  overdue: ["OVERDUE"],
  paid: ["PAID"],
  all: undefined,
};

export const PAYMENTS_LIMIT = 500;

export interface PaymentFilters {
  month?: number;
  year?: number;
  flatId?: string;
  status?: PaymentStatusFilter;
}

/** Dues for a society, newest period first. `flatId` can only narrow the society-scoped result. */
export async function getPayments(societyId: string, filters: PaymentFilters = {}) {
  const { month, year, flatId, status = "unpaid" } = filters;
  const statuses = STATUS_WHERE[status];
  return prisma.maintenancePayment.findMany({
    where: {
      societyId,
      ...(month && year ? { month, year } : {}),
      ...(flatId ? { flatId } : {}),
      ...(statuses ? { status: { in: statuses } } : {}),
    },
    include: {
      claim: { select: { status: true, utrNumber: true } },
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
      { year: "desc" },
      { month: "desc" },
      { flat: { floor: { wing: { name: "asc" } } } },
      { flat: { floor: { number: "asc" } } },
      { flat: { number: "asc" } },
    ],
    take: PAYMENTS_LIMIT,
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
      claim: { select: { id: true, status: true } },
      flat: {
        include: {
          floor: { include: { wing: { select: { name: true } } } },
        },
      },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
}
