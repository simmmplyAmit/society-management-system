"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { isValidUpiId } from "@/lib/utils/upi";
import { isExpired } from "@/lib/queries/upi";
import { notifyUpiChange } from "@/lib/notify/upi";
import { z } from "zod";
import { revalidatePath } from "next/cache";

// The society's UPI ID decides where residents' money goes, so changing it needs a second
// person: an admin requests, a *different* admin or treasurer approves. Every step is kept
// in UpiChangeRequest as the audit log.

const requestSchema = z.object({
  upiId: z.string().trim().refine((v) => isValidUpiId(v), "Enter a valid UPI ID, e.g. society@bank"),
});

function paths() {
  revalidatePath("/dashboard/upi");
  revalidatePath("/dashboard/society");
  revalidatePath("/dashboard/maintenance");
  revalidatePath("/dashboard");
}

/** ADMIN asks to change the UPI ID. The very first ID is set directly (nothing to divert yet). */
export async function requestUpiChange(formData: FormData) {
  const session = await requireRole(["ADMIN"]);
  const societyId = session.user.societyId;
  if (!societyId) return { error: "No society found" };

  const parsed = requestSchema.safeParse({ upiId: formData.get("upiId") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const newUpiId = parsed.data.upiId.toLowerCase();

  const society = await prisma.society.findUnique({ where: { id: societyId }, select: { upiId: true } });
  if (!society) return { error: "No society found" };
  if (society.upiId?.toLowerCase() === newUpiId) return { error: "That is already the current UPI ID" };

  const requester = { id: session.user.id, name: session.user.name };

  // First-time setup: apply right away and record it
  if (!society.upiId) {
    const now = new Date();
    await prisma.upiChangeRequest.create({
      data: {
        societyId, oldUpiId: null, newUpiId, status: "APPROVED",
        requestedById: requester.id, reviewedAt: now, reviewNote: "Initial set-up",
      },
    });
    await prisma.society.update({ where: { id: societyId }, data: { upiId: newUpiId, upiChangedAt: now } });
    paths();
    return { success: true as const, applied: true };
  }

  const existing = await prisma.upiChangeRequest.findFirst({
    where: { societyId, status: "PENDING" },
    select: { createdAt: true },
  });
  if (existing && !isExpired(existing.createdAt)) {
    return { error: "A change is already awaiting approval. Cancel it first to request another" };
  }

  const approvers = await prisma.user.count({
    where: { societyId, isActive: true, role: { in: ["ADMIN", "TREASURER"] }, id: { not: requester.id } },
  });
  if (approvers === 0) {
    return { error: "Another admin or a treasurer must exist to approve this. Add one in Residents first" };
  }

  await prisma.upiChangeRequest.create({
    data: { societyId, oldUpiId: society.upiId, newUpiId, requestedById: requester.id },
  });
  await notifyUpiChange({
    societyId, kind: "requested", oldUpiId: society.upiId, newUpiId,
    requestedById: requester.id, requestedByName: requester.name,
  });

  paths();
  return { success: true as const, applied: false };
}

/** A different ADMIN or TREASURER confirms the change; only then does the UPI ID switch. */
export async function approveUpiChange(requestId: string) {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId!;

  const req = await prisma.upiChangeRequest.findFirst({
    where: { id: requestId, societyId, status: "PENDING" },
    include: { requestedBy: { select: { name: true } } },
  });
  if (!req) return { error: "This request was already handled" };
  if (req.requestedById === session.user.id) return { error: "You can't approve your own request" };
  if (isExpired(req.createdAt)) return { error: "This request has expired. Ask for a new one" };

  // Take the decision first so two approvers can't both apply it
  const now = new Date();
  const taken = await prisma.upiChangeRequest.updateMany({
    where: { id: req.id, societyId, status: "PENDING" },
    data: { status: "APPROVED", reviewedById: session.user.id, reviewedAt: now },
  });
  if (taken.count !== 1) return { error: "This request was already handled" };

  await prisma.society.updateMany({
    where: { id: societyId },
    data: { upiId: req.newUpiId, upiChangedAt: now },
  });
  await prisma.upiChangeRequest.updateMany({
    where: { societyId, status: "PENDING", id: { not: req.id } },
    data: { status: "CANCELLED", reviewNote: "Superseded by an approved change" },
  });

  await notifyUpiChange({
    societyId, kind: "approved", oldUpiId: req.oldUpiId, newUpiId: req.newUpiId,
    requestedById: req.requestedById, requestedByName: req.requestedBy.name,
    reviewedByName: session.user.name,
  });

  paths();
  return { success: true as const };
}

const rejectSchema = z.object({
  requestId: z.string().min(1),
  reason: z.string().trim().max(200).optional(),
});

/** A different ADMIN or TREASURER declines the change; the UPI ID stays as it was. */
export async function rejectUpiChange(formData: FormData) {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId!;

  const parsed = rejectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { requestId, reason } = parsed.data;

  const req = await prisma.upiChangeRequest.findFirst({
    where: { id: requestId, societyId, status: "PENDING" },
    include: { requestedBy: { select: { name: true } } },
  });
  if (!req) return { error: "This request was already handled" };
  if (req.requestedById === session.user.id) return { error: "Use Cancel to withdraw your own request" };

  const taken = await prisma.upiChangeRequest.updateMany({
    where: { id: req.id, societyId, status: "PENDING" },
    data: { status: "REJECTED", reviewNote: reason || null, reviewedById: session.user.id, reviewedAt: new Date() },
  });
  if (taken.count !== 1) return { error: "This request was already handled" };

  await notifyUpiChange({
    societyId, kind: "rejected", oldUpiId: req.oldUpiId, newUpiId: req.newUpiId,
    requestedById: req.requestedById, requestedByName: req.requestedBy.name,
    reviewedByName: session.user.name, note: reason || null,
  });

  paths();
  return { success: true as const };
}

/** The admin who asked can withdraw their own pending request. */
export async function cancelUpiChange(requestId: string) {
  const session = await requireRole(["ADMIN"]);
  const societyId = session.user.societyId!;

  const taken = await prisma.upiChangeRequest.updateMany({
    where: { id: requestId, societyId, requestedById: session.user.id, status: "PENDING" },
    data: { status: "CANCELLED", reviewedAt: new Date(), reviewNote: "Withdrawn by requester" },
  });
  if (taken.count !== 1) return { error: "No pending request of yours to cancel" };

  paths();
  return { success: true as const };
}
