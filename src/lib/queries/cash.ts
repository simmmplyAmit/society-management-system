// Server-only reads for cash handling. Pass a societyId from the session.
import { prisma } from "@/lib/prisma";

/** Cash older than this many days in someone's hands is flagged. */
export const CASH_STALE_DAYS = 3;

export async function getCashState(societyId: string) {
  const [inHand, deposits] = await Promise.all([
    prisma.cashCollection.findMany({
      where: { societyId, depositId: null },
      include: {
        payer: { select: { name: true } },
        collectedBy: { select: { id: true, name: true } },
      },
      orderBy: { receivedOn: "asc" },
    }),
    prisma.cashDeposit.findMany({
      where: { societyId },
      include: {
        depositedBy: { select: { name: true } },
        confirmedBy: { select: { name: true } },
        _count: { select: { collections: true } },
      },
      orderBy: { depositedOn: "desc" },
      take: 10,
    }),
  ]);

  const holders = new Map<string, { id: string; name: string; total: number; count: number; oldest: Date }>();
  for (const c of inHand) {
    const h = holders.get(c.collectedBy.id) ?? { id: c.collectedBy.id, name: c.collectedBy.name, total: 0, count: 0, oldest: c.receivedOn };
    h.total = Math.round((h.total + Number(c.amount)) * 100) / 100;
    h.count += 1;
    if (c.receivedOn < h.oldest) h.oldest = c.receivedOn;
    holders.set(c.collectedBy.id, h);
  }
  const total = Math.round([...holders.values()].reduce((n, h) => n + h.total * 100, 0)) / 100;

  return { inHand, deposits, holders: [...holders.values()].sort((a, b) => b.total - a.total), total };
}
