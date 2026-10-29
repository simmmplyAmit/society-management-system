"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUnverified } from "@/lib/session";
import { issueOtp, verifyOtp } from "@/lib/otp";
import { sendEmail } from "@/lib/notify/email";
import { sendSms } from "@/lib/notify/sms";
import { otpMessage } from "@/lib/notify/templates";
import { normalizePhone } from "@/lib/utils/phone";
import { z } from "zod";

// These actions act only on the signed-in user's own account.

const codeSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");
const phoneSchema = z.string().transform((v, ctx) => {
  const p = normalizePhone(v);
  if (!p) ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit mobile number" });
  return p ?? "";
});

type SendResult = { error: string } | { success: true; devCode?: string };
type VerifyResult = { error: string } | { success: true };

export async function sendEmailCode(): Promise<SendResult> {
  const session = await getSessionUnverified();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, emailVerifiedAt: true, locale: true },
  });
  if (!user) return { error: "User not found" };
  if (user.emailVerifiedAt) return { error: "Email is already verified" };

  const target = user.email.toLowerCase();
  const issued = await issueOtp({ userId: user.id, purpose: "VERIFY_EMAIL", channel: "EMAIL", target });
  if (!issued.ok) return { error: issued.error };

  const msg = otpMessage(issued.code, "Verify your email address", user.locale);
  const sent = await sendEmail({ to: user.email, ...msg.email });
  if (!sent.ok) {
    console.error("[verify-email] send failed:", sent.error);
    return { error: "Could not send the code. Please try again shortly" };
  }
  return { success: true, devCode: sent.dev ? issued.code : undefined };
}

export async function verifyEmailCode(formData: FormData): Promise<VerifyResult> {
  const session = await getSessionUnverified();
  const code = codeSchema.safeParse(formData.get("code"));
  if (!code.success) return { error: code.error.issues[0].message };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });
  if (!user) return { error: "User not found" };

  const result = await verifyOtp({ purpose: "VERIFY_EMAIL", target: user.email.toLowerCase(), code: code.data });
  if (!result.ok || result.userId !== session.user.id) return { error: "Invalid or expired code" };

  await prisma.user.update({ where: { id: session.user.id }, data: { emailVerifiedAt: new Date() } });
  return { success: true };
}

export async function sendPhoneCode(formData: FormData): Promise<SendResult> {
  const session = await getSessionUnverified();
  const phone = phoneSchema.safeParse(formData.get("phone") ?? "");
  if (!phone.success) return { error: phone.error.issues[0].message };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, phone: true, phoneVerifiedAt: true },
  });
  if (!user) return { error: "User not found" };
  if (user.phoneVerifiedAt && user.phone === phone.data) return { error: "This number is already verified" };

  const issued = await issueOtp({ userId: user.id, purpose: "VERIFY_PHONE", channel: "SMS", target: phone.data });
  if (!issued.ok) return { error: issued.error };

  const msg = otpMessage(issued.code, "Verify your mobile number");
  const sent = await sendSms({ to: phone.data, ...msg.sms });
  if (!sent.ok) {
    console.error("[verify-phone] send failed:", sent.error);
    return { error: "Could not send the code. Please try again shortly" };
  }
  return { success: true, devCode: sent.dev ? issued.code : undefined };
}

export async function verifyPhoneCode(formData: FormData): Promise<VerifyResult> {
  const session = await getSessionUnverified();
  const phone = phoneSchema.safeParse(formData.get("phone") ?? "");
  if (!phone.success) return { error: phone.error.issues[0].message };
  const code = codeSchema.safeParse(formData.get("code"));
  if (!code.success) return { error: code.error.issues[0].message };

  const result = await verifyOtp({ purpose: "VERIFY_PHONE", target: phone.data, code: code.data });
  if (!result.ok || result.userId !== session.user.id) return { error: "Invalid or expired code" };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { phone: phone.data, phoneVerifiedAt: new Date() },
  });
  return { success: true };
}
