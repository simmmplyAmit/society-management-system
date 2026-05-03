"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const assignResidentSchema = z.object({
  flatId: z.string().min(1),
  userId: z.string().min(1),
  type: z.enum(["OWNER", "TENANT"]),
  isPrimary: z.coerce.boolean().default(false),
});

export async function assignResident(formData: FormData) {
  const session = await requireRole(["ADMIN"]);
  const societyId = session.user.societyId;
  if (!societyId) return { error: "No society found" };

  const parsed = assignResidentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Verify flat belongs to this society
  const flat = await prisma.flat.findFirst({
    where: { id: parsed.data.flatId, societyId },
  });
  if (!flat) return { error: "Flat not found" };

  // Verify user belongs to this society
  const user = await prisma.user.findFirst({
    where: { id: parsed.data.userId, societyId },
  });
  if (!user) return { error: "User not found" };

  try {
    await prisma.flatResident.create({
      data: {
        flatId: parsed.data.flatId,
        userId: parsed.data.userId,
        type: parsed.data.type,
        isPrimary: parsed.data.isPrimary,
      },
    });

    // Mark flat as occupied
    await prisma.flat.update({
      where: { id: parsed.data.flatId },
      data: { isOccupied: true },
    });

    // If TENANT, also create a TenantRecord
    if (parsed.data.type === "TENANT") {
      await prisma.tenantRecord.create({
        data: {
          flatId: parsed.data.flatId,
          userId: parsed.data.userId,
          startDate: new Date(),
        },
      });
    }
  } catch {
    return { error: "This user is already assigned to this flat" };
  }

  revalidatePath("/dashboard/residents");
  revalidatePath("/dashboard/society");
  return { success: true };
}

export async function removeResident(flatResidentId: string) {
  const session = await requireRole(["ADMIN"]);
  const societyId = session.user.societyId;

  const record = await prisma.flatResident.findFirst({
    where: {
      id: flatResidentId,
      flat: { societyId: societyId! },
    },
    include: { flat: true },
  });
  if (!record) return { error: "Record not found" };

  await prisma.flatResident.delete({ where: { id: flatResidentId } });

  // Close open tenant records if removing a tenant
  if (record.type === "TENANT") {
    await prisma.tenantRecord.updateMany({
      where: {
        flatId: record.flatId,
        userId: record.userId,
        endDate: null,
      },
      data: { endDate: new Date() },
    });
  }

  // Check if flat still has residents
  const remaining = await prisma.flatResident.count({
    where: { flatId: record.flatId },
  });
  if (remaining === 0) {
    await prisma.flat.update({
      where: { id: record.flatId },
      data: { isOccupied: false },
    });
  }

  revalidatePath("/dashboard/residents");
  revalidatePath("/dashboard/society");
  return { success: true };
}
