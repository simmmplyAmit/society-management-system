import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import type { Channel, OtpPurpose } from "@prisma/client";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_PER_HOUR = 5;

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

export function hashCode(code: string, target: string, purpose: OtpPurpose): string {
  return createHmac("sha256", secret()).update(`${purpose}:${target}:${code}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

type IssueResult = { ok: true; code: string } | { ok: false; error: string };

/**
 * Creates a fresh code for (purpose, target) and invalidates earlier ones.
 * Throttled in the database so it holds across serverless instances.
 */
export async function issueOtp(args: {
  userId?: string | null;
  purpose: OtpPurpose;
  channel: Channel;
  target: string;
  now?: Date;
}): Promise<IssueResult> {
  const { userId = null, purpose, channel, target } = args;
  const now = args.now ?? new Date();

  const last = await prisma.otpCode.findFirst({
    where: { target, purpose },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (last && now.getTime() - last.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    return { ok: false, error: "Please wait a minute before requesting another code" };
  }
  const recent = await prisma.otpCode.count({
    where: { target, purpose, createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) } },
  });
  if (recent >= OTP_MAX_PER_HOUR) {
    return { ok: false, error: "Too many codes requested. Try again in an hour" };
  }

  await prisma.otpCode.updateMany({
    where: { target, purpose, consumedAt: null },
    data: { consumedAt: now },
  });

  const code = generateCode();
  await prisma.otpCode.create({
    data: {
      userId,
      purpose,
      channel,
      target,
      codeHash: hashCode(code, target, purpose),
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    },
  });
  return { ok: true, code };
}

type VerifyResult = { ok: true; userId: string | null } | { ok: false; error: string };

const INVALID = { ok: false, error: "Invalid or expired code" } as const;

/** Checks a code. A correct code is single-use; wrong guesses count against the code. */
export async function verifyOtp(args: {
  purpose: OtpPurpose;
  target: string;
  code: string;
  now?: Date;
}): Promise<VerifyResult> {
  const { purpose, target, code } = args;
  const now = args.now ?? new Date();

  const row = await prisma.otpCode.findFirst({
    where: { purpose, target, consumedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
  if (!row || row.attempts >= OTP_MAX_ATTEMPTS) return INVALID;

  if (!safeEqual(row.codeHash, hashCode(code, target, purpose))) {
    await prisma.otpCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return INVALID;
  }

  // Claim atomically so two concurrent requests cannot both use the code
  const claimed = await prisma.otpCode.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: now },
  });
  if (claimed.count !== 1) return INVALID;
  return { ok: true, userId: row.userId };
}
