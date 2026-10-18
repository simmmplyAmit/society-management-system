"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";

const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
  role: z.enum(["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"]),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function createUser(formData: FormData) {
  const session = await requireRole(["ADMIN"]);
  const societyId = session.user.societyId;
  if (!societyId) return { error: "No society found" };

  const parsed = createUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) return { error: "A user with this email already exists" };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      role: parsed.data.role as Role,
      passwordHash,
      societyId,
    },
  });

  revalidatePath("/dashboard/residents");
  return { success: true };
}

export async function toggleUserActive(userId: string) {
  const session = await requireRole(["ADMIN"]);
  const societyId = session.user.societyId;

  const user = await prisma.user.findFirst({
    where: { id: userId, societyId: societyId! },
  });
  if (!user) return { error: "User not found" };

  if (user.isActive) {
    if (user.id === session.user.id) {
      return { error: "You cannot deactivate your own account" };
    }
    if (user.role === "ADMIN") {
      const activeAdmins = await prisma.user.count({
        where: { societyId: societyId!, role: "ADMIN", isActive: true },
      });
      if (activeAdmins <= 1) {
        return { error: "Cannot deactivate the last active admin" };
      }
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
  });

  revalidatePath("/dashboard/residents");
  return { success: true };
}
