"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const flatSchema = z.object({
  number: z.string().min(1, "Flat number is required"),
  floorId: z.string().min(1),
});

export async function addFlat(formData: FormData) {
  const session = await requireRole(["ADMIN"]);
  const societyId = session.user.societyId;
  if (!societyId) return { error: "No society found" };

  const parsed = flatSchema.safeParse({
    number: formData.get("number"),
    floorId: formData.get("floorId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Verify floor belongs to this society
  const floor = await prisma.floor.findFirst({
    where: { id: parsed.data.floorId, wing: { societyId } },
  });
  if (!floor) return { error: "Floor not found" };

  try {
    await prisma.flat.create({
      data: {
        number: parsed.data.number,
        floorId: parsed.data.floorId,
        societyId,
      },
    });
  } catch {
    return { error: "This flat number already exists on this floor" };
  }

  revalidatePath("/dashboard/society");
  return { success: true };
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
