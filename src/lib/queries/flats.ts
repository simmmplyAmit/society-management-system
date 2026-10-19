// Server-only. Pass a societyId and userId taken from the session.
import { prisma } from "@/lib/prisma";

export interface MyFlat {
  id: string;
  number: string;
  floor: { number: number; wing: { name: string } };
  type: "OWNER" | "TENANT";
  unpaidTotal: number;
  unpaidCount: number;
}

/** Every flat the user is linked to (owner or tenant), with what is still unpaid on it. */
export async function getMyFlats(societyId: string, userId: string): Promise<MyFlat[]> {
  const links = await prisma.flatResident.findMany({
    where: { userId, flat: { societyId } },
    include: {
      flat: { include: { floor: { include: { wing: { select: { name: true } } } } } },
    },
  });
  if (links.length === 0) return [];

  const unpaid = await prisma.maintenancePayment.groupBy({
    by: ["flatId"],
    where: { societyId, flatId: { in: links.map((l) => l.flatId) }, status: { in: ["PENDING", "OVERDUE"] } },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const byFlat = new Map(unpaid.map((u) => [u.flatId, u]));

  return links
    .map((l) => ({
      id: l.flatId,
      number: l.flat.number,
      floor: { number: l.flat.floor.number, wing: { name: l.flat.floor.wing.name } },
      type: l.type,
      unpaidTotal: Number(byFlat.get(l.flatId)?._sum.amount ?? 0),
      unpaidCount: byFlat.get(l.flatId)?._count._all ?? 0,
    }))
    .sort(
      (a, b) =>
        a.floor.wing.name.localeCompare(b.floor.wing.name) ||
        a.floor.number - b.floor.number ||
        a.number.localeCompare(b.number, undefined, { numeric: true })
    );
}
