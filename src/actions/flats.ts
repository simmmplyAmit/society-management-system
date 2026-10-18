"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { expandFlatRange } from "@/lib/utils/range";

const flatSchema = z.object({
  number: z.string().trim().min(1, "Flat number is required"),
  // Optional end of a range; blank means a single flat
  toNumber: z.string().trim().optional(),
  floorId: z.string().min(1),
});

export async function addFlat(formData: FormData) {
  const session = await requireRole(["ADMIN"]);
  const societyId = session.user.societyId;
  if (!societyId) return { error: "No society found" };

  const parsed = flatSchema.safeParse({
    number: formData.get("number"),
    toNumber: formData.get("toNumber") ?? undefined,
    floorId: formData.get("floorId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let numbers = [parsed.data.number];
  if (parsed.data.toNumber) {
    const range = expandFlatRange(parsed.data.number, parsed.data.toNumber);
    if (!range.values) return { error: range.error };
    numbers = range.values;
  }

  // Verify floor belongs to this society
  const floor = await prisma.floor.findFirst({
    where: { id: parsed.data.floorId, wing: { societyId } },
  });
  if (!floor) return { error: "Floor not found" };

  // A single flat errors if it exists; a range skips the ones that already do
  if (numbers.length === 1) {
    try {
      await prisma.flat.create({
        data: { number: numbers[0], floorId: parsed.data.floorId, societyId },
      });
    } catch {
      return { error: "This flat number already exists on this floor" };
    }
    revalidatePath("/dashboard/society");
    return { success: true as const, created: 1, skipped: 0 };
  }

  const { count } = await prisma.flat.createMany({
    data: numbers.map((number) => ({ number, floorId: parsed.data.floorId, societyId })),
    skipDuplicates: true,
  });

  revalidatePath("/dashboard/society");
  return { success: true as const, created: count, skipped: numbers.length - count };
}

export async function deleteFlat(flatId: string) {
  const session = await requireRole(["ADMIN"]);
  const societyId = session.user.societyId;

  const flat = await prisma.flat.findFirst({
    where: { id: flatId, societyId: societyId! },
    include: { _count: { select: { residents: true } } },
  });
  if (!flat) return { error: "Flat not found" };
  if (flat._count.residents > 0) {
    return { error: `Remove all residents from Flat ${flat.number} before deleting it` };
  }

  await prisma.flat.delete({ where: { id: flatId } });

  revalidatePath("/dashboard/society");
  return { success: true };
}
