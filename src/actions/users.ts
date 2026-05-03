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
  password: z.string().min(6, "Password must be at least 6 characters"),
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

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
  });

  revalidatePath("/dashboard/residents");
  return { success: true };
}

export async function getSocietyUsers(societyId: string) {
  return prisma.user.findMany({
    where: { societyId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
      flatResidents: {
        include: {
          flat: {
            include: {
              floor: { include: { wing: { select: { name: true } } } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}
