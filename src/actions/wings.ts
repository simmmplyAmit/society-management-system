"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const wingSchema = z.object({
  name: z.string().min(1, "Wing name is required"),
});

export async function addWing(formData: FormData) {
  const session = await requireRole(["ADMIN"]);
  const societyId = session.user.societyId;
  if (!societyId) return { error: "No society found" };

  const parsed = wingSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await prisma.wing.create({
      data: { name: parsed.data.name, societyId },
    });
  } catch {
    return { error: "A wing with this name already exists" };
  }

  revalidatePath("/dashboard/society");
  return { success: true };
}

export async function deleteWing(wingId: string) {
  const session = await requireRole(["ADMIN"]);
  const societyId = session.user.societyId;

  const wing = await prisma.wing.findFirst({
    where: { id: wingId, societyId: societyId! },
    include: { _count: { select: { floors: true } } },
  });
  if (!wing) return { error: "Wing not found" };
  if (wing._count.floors > 0) {
    return { error: `Remove all floors in Wing ${wing.name} before deleting it` };
  }

  await prisma.wing.delete({ where: { id: wingId } });

  revalidatePath("/dashboard/society");
  return { success: true };
}

export async function getWingsWithStructure(societyId: string) {
  return prisma.wing.findMany({
    where: { societyId },
    include: {
      floors: {
        orderBy: { number: "asc" },
        include: {
          flats: {
            orderBy: { number: "asc" },
            include: {
              residents: {
                include: { user: { select: { id: true, name: true, role: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}
