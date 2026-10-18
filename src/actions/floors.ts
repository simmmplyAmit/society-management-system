"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { expandFloorRange } from "@/lib/utils/range";

// z.coerce.number() turns a missing field (null) or "" into 0, so require a non-empty string first
const floorNumber = z
  .string({ error: "Floor number is required" })
  .min(1, "Floor number is required")
  .transform(Number)
  .pipe(z.number().int("Floor number must be a whole number").min(0, "Floor number must be 0 or above"));

const floorSchema = z.object({
  number: floorNumber,
  // Optional end of a range; blank means a single floor
  toNumber: z.preprocess((v) => (v === "" || v == null ? undefined : v), floorNumber.optional()),
  wingId: z.string().min(1),
});

/** Floor numbers to create from the "number" / "toNumber" fields. */
function floorNumbers(from: number, to: number | undefined) {
  return to === undefined ? { values: [from] } : expandFloorRange(from, to);
}

/** Creates floors in a wing. A single floor errors if it exists; a range skips existing ones. */
async function createFloors(wingId: string, numbers: number[]) {
  if (numbers.length === 1) {
    try {
      await prisma.floor.create({ data: { number: numbers[0], wingId } });
    } catch {
      return { error: "This floor number already exists" };
    }
    return { success: true as const, created: 1, skipped: 0 };
  }

  const { count } = await prisma.floor.createMany({
    data: numbers.map((number) => ({ number, wingId })),
    skipDuplicates: true,
  });
  return { success: true as const, created: count, skipped: numbers.length - count };
}

export async function addFloor(formData: FormData) {
  const session = await requireRole(["ADMIN"]);
  const societyId = session.user.societyId;
  if (!societyId) return { error: "No society found" };

  const parsed = floorSchema.safeParse({
    number: formData.get("number"),
    toNumber: formData.get("toNumber"),
    wingId: formData.get("wingId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const range = floorNumbers(parsed.data.number, parsed.data.toNumber);
  if (!range.values) return { error: range.error };

  // Verify wing belongs to this society
  const wing = await prisma.wing.findFirst({
    where: { id: parsed.data.wingId, societyId },
  });
  if (!wing) return { error: "Wing not found" };

  const result = await createFloors(parsed.data.wingId, range.values);
  if (result.error) return { error: "This floor number already exists in this wing" };

  revalidatePath("/dashboard/society");
  return result;
}

/** Add a floor directly to a wingless society (auto-creates the hidden _default_ wing). */
export async function addFloorDirect(formData: FormData) {
  const session = await requireRole(["ADMIN"]);
  const societyId = session.user.societyId;
  if (!societyId) return { error: "No society found" };

  const parsed = floorSchema.omit({ wingId: true }).safeParse({
    number: formData.get("number"),
    toNumber: formData.get("toNumber"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const range = floorNumbers(parsed.data.number, parsed.data.toNumber);
  if (!range.values) return { error: range.error };

  // Find or create the hidden default wing
  const defaultWing = await prisma.wing.upsert({
    where: { societyId_name: { societyId, name: "_default_" } },
    create: { name: "_default_", societyId },
    update: {},
  });

  const result = await createFloors(defaultWing.id, range.values);
  if (result.error) return { error: result.error };

  revalidatePath("/dashboard/society");
  return result;
}

export async function deleteFloor(floorId: string) {
  const session = await requireRole(["ADMIN"]);
  const societyId = session.user.societyId;

  const floor = await prisma.floor.findFirst({
    where: { id: floorId, wing: { societyId: societyId! } },
    include: { _count: { select: { flats: true } } },
  });
  if (!floor) return { error: "Floor not found" };
  if (floor._count.flats > 0) {
    return { error: `Remove all flats on Floor ${floor.number} before deleting it` };
  }

  await prisma.floor.delete({ where: { id: floorId } });

  revalidatePath("/dashboard/society");
  return { success: true };
}
