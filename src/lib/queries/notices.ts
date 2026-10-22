// Server-only data access (not a "use server" file). Pass a societyId taken from the session.
import { prisma } from "@/lib/prisma";

const LIVE = (now: Date) => ({
  deletedAt: null,
  OR: [{ expiresOn: null }, { expiresOn: { gte: now } }],
});

/** Notices residents should see: not deleted, not expired. Pinned first, then newest. */
export async function getNotices(societyId: string, now = new Date(), take = 50) {
  return prisma.notice.findMany({
    where: { societyId, ...LIVE(now) },
    include: { author: { select: { name: true } } },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take,
  });
}

/** Expired notices, for the committee's archive. */
export async function getExpiredNotices(societyId: string, now = new Date(), take = 20) {
  return prisma.notice.findMany({
    where: { societyId, deletedAt: null, expiresOn: { lt: now } },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function getLatestNotices(societyId: string, take = 3, now = new Date()) {
  return prisma.notice.findMany({
    where: { societyId, ...LIVE(now) },
    select: { id: true, title: true, category: true, pinned: true, createdAt: true },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take,
  });
}
