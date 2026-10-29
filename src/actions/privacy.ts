"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession, requireRole } from "@/lib/session";
import { PRIVACY_VERSION, REQUEST_NOTE_MAX } from "@/lib/privacy";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const MEMBERS = ["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"] as const;
const MAX_OPEN_REQUESTS = 3;

function paths() {
  revalidatePath("/dashboard/privacy");
}

/** The person agrees to the current privacy notice. Kept as a log entry and on their profile. */
export async function acceptPrivacy(formData: FormData) {
  const session = await getSession();
  if (formData.get("agree") !== "on") return { error: "Please tick the box to agree and continue" };

  const { id: userId, societyId } = session.user;
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { privacyAcceptedAt: new Date(), privacyVersion: PRIVACY_VERSION } }),
    prisma.consentRecord.create({ data: { userId, societyId: societyId ?? null, version: PRIVACY_VERSION } }),
  ]);
  return { success: true as const };
}

const requestSchema = z.object({
  type: z.enum(["CORRECTION", "ERASURE"]),
  note: z.string().trim().max(REQUEST_NOTE_MAX, `Keep it under ${REQUEST_NOTE_MAX} characters`).optional(),
});

/** Ask the society to correct or erase your personal data. An admin handles it. */
export async function requestDataChange(formData: FormData) {
  const session = await requireRole([...MEMBERS]);
  const { id: userId, societyId } = session.user;
  if (!societyId) return { error: "No society found" };

  const parsed = requestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.type === "CORRECTION" && !parsed.data.note) return { error: "Tell us what needs to be corrected" };

  const open = await prisma.dataRequest.count({ where: { userId, societyId, status: "OPEN" } });
  if (open >= MAX_OPEN_REQUESTS) return { error: "You already have open requests. Please wait for them to be handled" };
  const dup = await prisma.dataRequest.findFirst({
    where: { userId, societyId, type: parsed.data.type, status: "OPEN" },
    select: { id: true },
  });
  if (dup) return { error: "You already have an open request of this kind" };

  await prisma.dataRequest.create({
    data: { societyId, userId, type: parsed.data.type, note: parsed.data.note || null },
  });
  paths();
  return { success: true as const };
}

/** An admin closes a request. Nobody handles their own request. */
export async function resolveDataRequest(requestId: string, status: "DONE" | "REJECTED", note?: string) {
  const session = await requireRole(["ADMIN"]);
  const { id: adminId, societyId } = session.user;
  if (status !== "DONE" && status !== "REJECTED") return { error: "Unknown status" };

  const resolution = note?.trim().slice(0, REQUEST_NOTE_MAX) || null;
  if (status === "REJECTED" && !resolution) return { error: "Say why the request is being declined" };

  const req = await prisma.dataRequest.findFirst({
    where: { id: requestId, societyId: societyId!, status: "OPEN" },
    select: { id: true, userId: true },
  });
  if (!req) return { error: "Request not found or already handled" };
  if (req.userId === adminId) return { error: "Another admin must handle your own request" };

  const r = await prisma.dataRequest.updateMany({
    where: { id: req.id, societyId: societyId!, status: "OPEN" },
    data: { status, handledById: adminId, handledAt: new Date(), resolutionNote: resolution },
  });
  if (r.count !== 1) return { error: "Request not found or already handled" };
  paths();
  return { success: true as const };
}

/**
 * Erase a person's profile while keeping the society's financial records. The account is closed
 * and its name, email, phone and sign-in are removed; posts and comments they wrote are deleted;
 * dues, payments, receipts and complaints stay, now without their identity.
 */
export async function anonymiseUser(userId: string) {
  const session = await requireRole(["ADMIN"]);
  const { id: adminId, societyId } = session.user;
  if (userId === adminId) return { error: "Another admin must erase your own account" };

  const user = await prisma.user.findFirst({
    where: { id: userId, societyId: societyId! },
    select: { id: true, role: true, email: true },
  });
  if (!user) return { error: "User not found" };
  if (user.email.endsWith("@removed.invalid")) return { error: "This account was already erased" };

  // Credit can only be spent on dues, so erasing an account that holds some would lose the member's money
  const credit = await prisma.creditEntry.aggregate({ where: { societyId: societyId!, userId }, _sum: { amount: true } });
  if (Math.round(Number(credit._sum.amount ?? 0) * 100) > 0) {
    return { error: "This member still holds credit. Use it up or settle it with them before erasing the account" };
  }
  const [claims, contributions] = await Promise.all([
    prisma.paymentClaim.count({ where: { societyId: societyId!, userId, status: "SUBMITTED" } }),
    prisma.expenseContribution.count({ where: { societyId: societyId!, userId, status: "PENDING" } }),
  ]);
  if (claims > 0 || contributions > 0) return { error: "Review this member's pending payment reports first" };

  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10); // nobody knows it: the account can't be used
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        name: "Former resident",
        email: `removed-${userId}@removed.invalid`,
        phone: null,
        avatarUrl: null,
        passwordHash,
        isActive: false,
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
      },
    }),
    prisma.postComment.deleteMany({ where: { authorId: userId } }),
    prisma.post.deleteMany({ where: { authorId: userId } }),
    prisma.otpCode.deleteMany({ where: { userId } }),
    prisma.account.deleteMany({ where: { userId } }),
    // Delivery logs keep the address the message went to
    prisma.notificationLog.updateMany({ where: { userId, societyId: societyId! }, data: { to: "[removed]" } }),
    prisma.dataRequest.updateMany({
      where: { userId, societyId: societyId!, type: "ERASURE", status: "OPEN" },
      data: { status: "DONE", handledById: adminId, handledAt: new Date(), resolutionNote: "Account erased. Financial records were kept without the person's identity." },
    }),
  ]);
  paths();
  revalidatePath("/dashboard/residents");
  return { success: true as const };
}
