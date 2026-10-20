// Server-only billing for "other charges". Deliberately NOT a "use server" file.
// Each billing becomes an ordinary MaintenancePayment (label = charge name, chargeKey = charge id),
// so credit, part-payments, claims and reminders handle it with no special cases.
import { prisma } from "@/lib/prisma";
import {
  chargeAmountFor, dueMonths, flatMatches,
  type ChargeBasis, type ChargeFrequency, type ChargeSchedule,
} from "@/lib/utils/special-charges";

const CHUNK = 500;

export interface GenerateResult {
  created: number;
  /** Flats in a per-sq-ft charge's target group that could not be billed: no area on record. */
  missingArea: number;
}

/**
 * Create the dues for every active charge whose billing month has arrived. Idempotent: the unique
 * (flat, month, year, charge) key makes reruns skip what already exists, so it is safe from the
 * cron, after creating a charge, and after fixing flat details.
 */
export async function generateSpecialChargeDues(
  societyId: string,
  opts: { chargeId?: string; now?: Date } = {}
): Promise<GenerateResult> {
  const now = opts.now ?? new Date();
  const upTo = { month: now.getMonth() + 1, year: now.getFullYear() };

  const charges = await prisma.specialCharge.findMany({
    where: { societyId, isActive: true, ...(opts.chargeId ? { id: opts.chargeId } : {}) },
  });
  if (charges.length === 0) return { created: 0, missingArea: 0 };

  const rawFlats = await prisma.flat.findMany({
    where: { societyId },
    select: { id: true, configuration: true, areaSqFt: true },
  });
  const flats = rawFlats.map((f) => ({
    id: f.id,
    configuration: f.configuration,
    areaSqFt: f.areaSqFt == null ? null : Number(f.areaSqFt),
  }));

  let created = 0;
  let missingArea = 0;

  for (const c of charges) {
    const periods = dueMonths(
      {
        schedule: c.schedule as ChargeSchedule,
        frequency: c.frequency as ChargeFrequency | null,
        startMonth: c.startMonth, startYear: c.startYear, endMonth: c.endMonth, endYear: c.endYear,
      },
      upTo
    );
    if (periods.length === 0) continue;

    const rules = {
      basis: c.basis as ChargeBasis,
      rate: Number(c.rate),
      configurations: c.configurations,
      minArea: c.minArea == null ? null : Number(c.minArea),
      maxArea: c.maxArea == null ? null : Number(c.maxArea),
    };

    const rows: {
      societyId: string; flatId: string; month: number; year: number; amount: number;
      status: "PENDING"; chargeKey: string; label: string; specialChargeId: string;
    }[] = [];
    for (const f of flats) {
      if (!flatMatches(f, rules)) continue;
      const amount = chargeAmountFor(f, rules);
      if (amount == null) {
        missingArea += 1;
        continue;
      }
      for (const p of periods) {
        rows.push({
          societyId, flatId: f.id, month: p.month, year: p.year, amount,
          status: "PENDING", chargeKey: c.id, label: c.name, specialChargeId: c.id,
        });
      }
    }

    for (let i = 0; i < rows.length; i += CHUNK) {
      const r = await prisma.maintenancePayment.createMany({ data: rows.slice(i, i + CHUNK), skipDuplicates: true });
      created += r.count;
    }
  }

  return { created, missingArea };
}

/** Daily cron: bill every active society's charges that have come due. */
export async function generateAllSpecialCharges(now: Date = new Date()): Promise<GenerateResult> {
  const societies = await prisma.society.findMany({ where: { isActive: true }, select: { id: true } });
  const total: GenerateResult = { created: 0, missingArea: 0 };
  for (const s of societies) {
    const r = await generateSpecialChargeDues(s.id, { now });
    total.created += r.created;
    total.missingArea += r.missingArea;
  }
  return total;
}

/** Charges for the Other charges tab, with how much has been billed so far. */
export async function getSpecialCharges(societyId: string) {
  const [charges, billed] = await Promise.all([
    prisma.specialCharge.findMany({ where: { societyId }, orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] }),
    prisma.maintenancePayment.groupBy({
      by: ["specialChargeId"],
      where: { societyId, specialChargeId: { not: null } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);
  const byCharge = new Map(billed.map((b) => [b.specialChargeId, b]));
  return charges.map((c) => ({
    ...c,
    billedCount: byCharge.get(c.id)?._count._all ?? 0,
    billedTotal: Number(byCharge.get(c.id)?._sum.amount ?? 0),
  }));
}
