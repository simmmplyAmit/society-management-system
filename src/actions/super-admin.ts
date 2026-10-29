"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { isValidUpiId } from "@/lib/utils/upi";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { emailWhere } from "@/lib/utils/email";

const createSocietySchema = z.object({
  societyName: z.string().trim().min(2, "Society name must be at least 2 characters"),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  upiId: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || isValidUpiId(v), "Enter a valid UPI ID (e.g. society@bank)"),
  adminName: z.string().trim().min(2, "Admin name must be at least 2 characters"),
  adminEmail: z.string().trim().toLowerCase().email("Enter a valid admin email"),
  adminPassword: z.string().min(8, "Password must be at least 8 characters"),
});

/** Product team onboarding: creates a society together with its first ADMIN user. */
export async function createSociety(formData: FormData) {
  await requireRole(["SUPER_ADMIN"]);

  const parsed = createSocietySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const existing = await prisma.user.findFirst({ where: emailWhere(d.adminEmail), select: { id: true } });
  if (existing) return { error: "A user with this email already exists" };

  const passwordHash = await bcrypt.hash(d.adminPassword, 12);

  await prisma.society.create({
    data: {
      name: d.societyName,
      city: d.city || null,
      state: d.state || null,
      upiId: d.upiId || null,
      users: {
        create: {
          name: d.adminName,
          email: d.adminEmail,
          passwordHash,
          role: "ADMIN",
        },
      },
    },
  });

  revalidatePath("/super-admin");
  return { success: true as const };
}
