// Server-only data access (not a "use server" file). Everything a person is entitled to a copy of.
import { prisma } from "@/lib/prisma";

export async function getMyData(societyId: string, userId: string) {
  const [user, flats, credit, claims, complaints, posts, comments, uploads, messages, consents, requests] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true, email: true, phone: true, role: true, createdAt: true,
        emailVerifiedAt: true, phoneVerifiedAt: true, privacyAcceptedAt: true, privacyVersion: true,
      },
    }),
    prisma.flatResident.findMany({
      where: { userId, flat: { societyId } },
      select: { type: true, isPrimary: true, flat: { select: { number: true, floor: { select: { number: true, wing: { select: { name: true } } } } } } },
    }),
    prisma.creditEntry.findMany({
      where: { societyId, userId },
      select: { type: true, amount: true, reference: true, note: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.paymentClaim.findMany({
      where: { societyId, userId },
      select: { utrNumber: true, amount: true, paidOn: true, status: true, reviewNote: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.complaint.findMany({
      where: { societyId, raisedById: userId },
      select: {
        category: true, title: true, description: true, priority: true, status: true, resolutionNote: true, createdAt: true,
        updates: { where: { internal: false }, select: { kind: true, body: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.post.findMany({ where: { societyId, authorId: userId }, select: { category: true, body: true, status: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
    prisma.postComment.findMany({ where: { societyId, authorId: userId }, select: { body: true, status: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
    prisma.document.findMany({
      where: { societyId, uploadedById: userId, status: { in: ["READY", "DELETED"] } },
      select: { title: true, category: true, fileName: true, sizeBytes: true, createdAt: true, status: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.notificationLog.findMany({
      where: { societyId, userId },
      select: { kind: true, channel: true, to: true, status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 1000,
    }),
    prisma.consentRecord.findMany({ where: { userId }, select: { version: true, acceptedAt: true }, orderBy: { acceptedAt: "asc" } }),
    prisma.dataRequest.findMany({
      where: { societyId, userId },
      select: { type: true, note: true, status: true, resolutionNote: true, createdAt: true, handledAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    about:
      "A copy of the personal data Society MS holds about you. Financial records of your flat (dues, receipts) are kept by your society and are not repeated here beyond your own payments and credit.",
    profile: user,
    flats: flats.map((f) => ({
      flat: f.flat.number, floor: f.flat.floor.number, wing: f.flat.floor.wing.name, relationship: f.type, primary: f.isPrimary,
    })),
    creditLedger: credit.map((c) => ({ ...c, amount: Number(c.amount) })),
    paymentReports: claims.map((c) => ({ ...c, amount: Number(c.amount) })),
    complaints,
    communityPosts: posts,
    communityComments: comments,
    uploadedFiles: uploads,
    messagesSentToYou: messages,
    consentHistory: consents,
    dataRequests: requests,
  };
}
