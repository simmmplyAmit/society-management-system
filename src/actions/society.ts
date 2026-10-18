"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const societySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  pincode: z.string().nullable(),
  upiId: z.string().nullable(),
  hasWings: z.boolean(),
});

export async function updateSociety(formData: FormData) {
  const session = await requireRole(["ADMIN"]);
  const societyId = session.user.societyId;
  if (!societyId) return { error: "No society found" };

  // Convert empty strings to null for optional fields; handle checkbox explicitly
  const parsed = societySchema.safeParse({
    name: formData.get("name"),
    address: (formData.get("address") as string)?.trim() || null,
    city: (formData.get("city") as string)?.trim() || null,
    state: (formData.get("state") as string)?.trim() || null,
    pincode: (formData.get("pincode") as string)?.trim() || null,
    upiId: (formData.get("upiId") as string)?.trim() || null,
    hasWings: formData.get("hasWings") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await prisma.society.update({
      where: { id: societyId },
      data: parsed.data,
    });
  } catch {
    return { error: "Failed to save society details" };
  }

  revalidatePath("/dashboard/society");
  return { success: true };
}
