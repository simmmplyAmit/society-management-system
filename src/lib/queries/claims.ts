// Server-only reads for resident-reported payments. Pass a societyId from the session.
import { prisma } from "@/lib/prisma";

export async function getPendingClaims(societyId: string) {
  return prisma.paymentClaim.findMany({
    where: { societyId, status: "SUBMITTED" },
    include: {
      user: { select: { name: true, phone: true } },
      documents: { where: { status: "READY" }, select: { id: true, fileName: true, mimeType: true }, orderBy: { createdAt: "asc" } },
      payments: {
        select: {
          id: true, month: true, year: true, amount: true, amountPaid: true, label: true,
          flat: {
            select: {
              number: true,
              floor: { select: { number: true, wing: { select: { name: true } } } },
            },
          },
        },
        orderBy: [{ year: "asc" }, { month: "asc" }],
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function countPendingClaims(societyId: string) {
  return prisma.paymentClaim.count({ where: { societyId, status: "SUBMITTED" } });
}

/** A resident's most recent reports, newest first. */
export async function getResidentClaims(societyId: string, userId: string, take = 5) {
  return prisma.paymentClaim.findMany({
    where: { societyId, userId },
    select: {
      id: true, utrNumber: true, amount: true, status: true, reviewNote: true, createdAt: true,
      _count: { select: { payments: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** A member's recent credit movements, newest first. */
export async function getCreditActivity(societyId: string, userId: string, take = 10) {
  return prisma.creditEntry.findMany({
    where: { societyId, userId },
    select: { id: true, type: true, amount: true, reference: true, note: true, createdAt: true, paymentId: true },
    orderBy: { createdAt: "desc" },
    take,
  });
}
