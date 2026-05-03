"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const floorSchema = z.object({
  number: z.coerce.number().int().min(0, "Floor number must be 0 or above"),
  wingId: z.string().min(1),
});

export async function addFloor(formData: FormData) {
  const session = await requireRole(["ADMIN"]);
  const societyId = session.user.societyId;
  if (!societyId) return { error: "No society found" };

  const parsed = floorSchema.safeParse({
    number: formData.get("number"),
    wingId: formData.get("wingId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Verify wing belongs to this society
  const wing = await prisma.wing.findFirst({
    where: { id: parsed.data.wingId, societyId },
  });
  if (!wing) return { error: "Wing not found" };

  try {
    await prisma.floor.create({
      data: { number: parsed.data.number, wingId: parsed.data.wingId },
    });
  } catch {
    return { error: "This floor number already exists in this wing" };
  }

  revalidatePath("/dashboard/society");
  return { success: true };
}

/** Add a floor directly to a wingless society (auto-creates the hidden _default_ wing). */
export async function addFloorDirect(formData: FormData) {
  const session = await requireRole(["ADMIN"]);
  const societyId = session.user.societyId;
  if (!societyId) return { error: "No society found" };

  const parsed = z.object({
    number: z.coerce.number().int().min(0, "Floor number must be 0 or above"),
  }).safeParse({ number: formData.get("number") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Find or create the hidden default wing
  const defaultWing = await prisma.wing.upsert({
    where: { societyId_name: { societyId, name: "_default_" } },
    create: { name: "_default_", societyId },
    update: {},
  });

  try {
    await prisma.floor.create({
      data: { number: parsed.data.number, wingId: defaultWing.id },
    });
  } catch {
    return { error: "This floor number already exists" };
  }

  revalidatePath("/dashboard/society");
  return { success: true };
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
