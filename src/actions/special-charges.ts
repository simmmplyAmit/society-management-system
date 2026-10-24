"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { generateSpecialChargeDues } from "@/lib/queries/special-charges";
import { sendNewDueNotices } from "@/lib/notify/schedule";
import { applyCreditAndNotify } from "@/lib/credit-service";
import { normalizeConfig, totalPeriods } from "@/lib/utils/special-charges";
import { toIdx } from "@/lib/utils/maintenance";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const MAX_RATE = 1_000_000;

const optionalNumber = (label: string) =>
  z
    .union([z.literal(""), z.coerce.number().positive(`${label} must be positive`).max(100_000, `${label} is too large`)])
    .optional()
    .transform((v) => (typeof v === "number" ? v : null));

const createSchema = z
  .object({
    name: z.string().trim().min(2, "Give the charge a name").max(60, "Name is too long"),
    description: z.string().trim().max(200).optional(),
    schedule: z.enum(["ONE_TIME", "RECURRING"]),
    frequency: z.enum(["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"]).optional(),
    startMonth: z.coerce.number().int().min(1).max(12),
    startYear: z.coerce.number().int().min(MIN_YEAR).max(MAX_YEAR),
    endMonth: z.coerce.number().int().min(1).max(12).optional(),
    endYear: z.coerce.number().int().min(MIN_YEAR).max(MAX_YEAR).optional(),
    basis: z.enum(["FIXED", "PER_SQFT"]),
    rate: z.coerce.number().positive("Enter the amount").max(MAX_RATE, "That amount is too large"),
    minArea: optionalNumber("Minimum area"),
    maxArea: optionalNumber("Maximum area"),
  })
  .superRefine((d, ctx) => {
    if (d.schedule === "RECURRING") {
      if (!d.frequency) ctx.addIssue({ code: "custom", message: "Choose how often it repeats" });
      if (d.endMonth == null || d.endYear == null) {
        ctx.addIssue({ code: "custom", message: "A recurring charge needs an end month" });
      } else if (toIdx(d.endMonth, d.endYear) < toIdx(d.startMonth, d.startYear)) {
        ctx.addIssue({ code: "custom", message: "The end month cannot be before the start month" });
      }
    }
    if (d.minArea != null && d.maxArea != null && d.minArea > d.maxArea) {
      ctx.addIssue({ code: "custom", message: "Minimum area cannot exceed the maximum" });
    }
  });

function paths() {
  revalidatePath("/dashboard/maintenance");
}

/** ADMIN defines an other charge and it is billed straight away for any month that has arrived. */
export async function createSpecialCharge(formData: FormData) {
  const session = await requireRole(["ADMIN"]);
  const societyId = session.user.societyId;
  if (!societyId) return { error: "No society found" };

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const configurations = [
    ...new Set(formData.getAll("configuration").map((v) => normalizeConfig(String(v))).filter(Boolean)),
  ];

  const recurring = d.schedule === "RECURRING";
  if (totalPeriods({
    schedule: d.schedule, frequency: recurring ? d.frequency ?? null : null,
    startMonth: d.startMonth, startYear: d.startYear,
    endMonth: recurring ? d.endMonth ?? null : null, endYear: recurring ? d.endYear ?? null : null,
  }) > 60) {
    return { error: "A charge can repeat at most 60 times. Shorten the period or repeat less often" };
  }

  const charge = await prisma.specialCharge.create({
    data: {
      societyId,
      name: d.name,
      description: d.description || null,
      basis: d.basis,
      rate: d.rate,
      schedule: d.schedule,
      frequency: recurring ? d.frequency : null,
      startMonth: d.startMonth,
      startYear: d.startYear,
      endMonth: recurring ? d.endMonth : null,
      endYear: recurring ? d.endYear : null,
      configurations,
      minArea: d.minArea,
      maxArea: d.maxArea,
      createdById: session.user.id,
    },
    select: { id: true },
  });

  const { created, missingArea } = await generateSpecialChargeDues(societyId, { chargeId: charge.id });
  if (created > 0) await applyCreditAndNotify(societyId); // members' credit pays new dues first

  let notified: { sent: number; failed: number; skipped: number } | undefined;
  if (created > 0 && formData.get("notify") === "on") {
    try {
      notified = await sendNewDueNotices({ societyId });
    } catch (err) {
      console.error("[createSpecialCharge] notify failed:", err);
    }
  }

  paths();
  return { success: true as const, created, missingArea, notified };
}

/** Stop billing a charge. Dues already raised stay as they are. */
export async function stopSpecialCharge(chargeId: string) {
  const session = await requireRole(["ADMIN"]);
  const societyId = session.user.societyId!;

  const r = await prisma.specialCharge.updateMany({
    where: { id: chargeId, societyId, isActive: true },
    data: { isActive: false },
  });
  if (r.count !== 1) return { error: "Charge not found or already stopped" };

  paths();
  return { success: true as const };
}

/** Bill again (idempotent), e.g. after areas were filled in for flats that were skipped. */
export async function generateSpecialChargeNow(chargeId: string) {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId!;

  const charge = await prisma.specialCharge.findFirst({
    where: { id: chargeId, societyId, isActive: true },
    select: { id: true },
  });
  if (!charge) return { error: "Charge not found" };

  const { created, missingArea } = await generateSpecialChargeDues(societyId, { chargeId });
  if (created > 0) await applyCreditAndNotify(societyId);

  paths();
  return { success: true as const, created, missingArea };
}

const rowsSchema = z
  .array(
    z.object({
      id: z.string().min(1),
      configuration: z.string().trim().max(30, "Configuration is too long").nullable(),
      areaSqFt: z.number().positive("Area must be positive").max(100_000, "Area is too large").nullable(),
    })
  )
  .min(1, "Nothing to save")
  .max(500, "Too many flats at once");

/** ADMIN sets configuration (e.g. "2 BHK") and area for flats, used to target other charges. */
export async function updateFlatDetails(formData: FormData) {
  const session = await requireRole(["ADMIN"]);
  const societyId = session.user.societyId;
  if (!societyId) return { error: "No society found" };

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("rows") ?? ""));
  } catch {
    return { error: "Invalid data" };
  }
  const parsed = rowsSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let updated = 0;
  for (const row of parsed.data) {
    // updateMany with societyId so one society can never touch another's flats
    const r = await prisma.flat.updateMany({
      where: { id: row.id, societyId },
      data: { configuration: row.configuration || null, areaSqFt: row.areaSqFt },
    });
    updated += r.count;
  }

  revalidatePath("/dashboard/society");
  revalidatePath("/dashboard/maintenance");
  return { success: true as const, updated };
}
