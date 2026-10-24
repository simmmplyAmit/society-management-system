// Server-only reads for UPI ID changes. Pass a societyId from the session.
import { prisma } from "@/lib/prisma";

/** A request that nobody approves within this window lapses and must be raised again. */
export const UPI_REQUEST_TTL_DAYS = 7;
export const UPI_REQUEST_TTL_MS = UPI_REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000;
/** Residents see a "recently changed" notice for this long after a change. */
export const UPI_CHANGE_NOTICE_DAYS = 14;

/** True while residents should still see the "UPI ID changed recently" notice. */
export function isRecentUpiChange(changedAt: Date | null, now: Date = new Date()): boolean {
  return !!changedAt && now.getTime() - changedAt.getTime() < UPI_CHANGE_NOTICE_DAYS * 24 * 60 * 60 * 1000;
}

export function isExpired(createdAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - createdAt.getTime() > UPI_REQUEST_TTL_MS;
}

export async function getUpiState(societyId: string, now: Date = new Date()) {
  const [society, requests, approvers] = await Promise.all([
    prisma.society.findUnique({ where: { id: societyId }, select: { upiId: true, upiChangedAt: true } }),
    prisma.upiChangeRequest.findMany({
      where: { societyId },
      include: {
        requestedBy: { select: { name: true } },
        reviewedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.user.findMany({
      where: { societyId, isActive: true, role: { in: ["ADMIN", "TREASURER"] } },
      select: { id: true },
    }),
  ]);

  const pending = requests.find((r) => r.status === "PENDING" && !isExpired(r.createdAt, now)) ?? null;
  return {
    upiId: society?.upiId ?? null,
    upiChangedAt: society?.upiChangedAt ?? null,
    pending,
    history: requests.filter((r) => r.id !== pending?.id).slice(0, 10),
    approverIds: approvers.map((a) => a.id),
  };
}

/** For the home-page banner: a pending request someone else must approve. */
export async function getPendingUpiRequestFor(societyId: string, userId: string, now: Date = new Date()) {
  const r = await prisma.upiChangeRequest.findFirst({
    where: { societyId, status: "PENDING", requestedById: { not: userId } },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, newUpiId: true },
  });
  return r && !isExpired(r.createdAt, now) ? r : null;
}
