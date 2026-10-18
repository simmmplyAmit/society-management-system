"use server";

import { prisma } from "@/lib/prisma";
import { issueOtp, verifyOtp } from "@/lib/otp";
import { sendEmail } from "@/lib/notify/email";
import { otpMessage } from "@/lib/notify/templates";
import { resetAttempts } from "@/lib/rate-limit";
import { z } from "zod";
import bcrypt from "bcryptjs";

// Public endpoints (the user is logged out). They never reveal whether an email exists.

const requestSchema = z.object({ email: z.string().trim().toLowerCase().pipe(z.string().email("Enter a valid email")) });

const resetSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.string().email("Enter a valid email")),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function requestPasswordReset(formData: FormData) {
  const parsed = requestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, isActive: true },
  });

  if (user?.isActive) {
    // Throttle errors are swallowed on purpose: the response must look the same for every email
    const issued = await issueOtp({
      userId: user.id,
      purpose: "RESET_PASSWORD",
      channel: "EMAIL",
      target: user.email.toLowerCase(),
    });
    if (issued.ok) {
      const msg = otpMessage(issued.code, "Reset your password");
      const sent = await sendEmail({ to: user.email, ...msg.email });
      if (!sent.ok) console.error("[password-reset] send failed:", sent.error);
    }
  }
  return { success: true as const };
}

export async function resetPassword(formData: FormData) {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, code, password } = parsed.data;

  const result = await verifyOtp({ purpose: "RESET_PASSWORD", target: email, code });
  if (!result.ok || !result.userId) return { error: "Invalid or expired code" };

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.findUnique({
    where: { id: result.userId },
    select: { emailVerifiedAt: true },
  });
  await prisma.user.update({
    where: { id: result.userId },
    data: {
      passwordHash,
      // Receiving the code proves ownership of the mailbox
      ...(user?.emailVerifiedAt ? {} : { emailVerifiedAt: new Date() }),
    },
  });
  resetAttempts(email);
  return { success: true as const };
}
