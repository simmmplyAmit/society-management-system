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

/** Active members linked to a flat, labelled "Name · A-101, B-202", for pickers. */
export async function getMemberOptions(societyId: string): Promise<{ id: string; label: string }[]> {
  const rows = await prisma.flatResident.findMany({
    where: { flat: { societyId }, user: { isActive: true } },
    select: { user: { select: { id: true, name: true } }, flat: { select: { number: true } } },
    orderBy: { user: { name: "asc" } },
  });
  const byUser = new Map<string, { name: string; flats: string[] }>();
  for (const r of rows) {
    const e = byUser.get(r.user.id) ?? { name: r.user.name, flats: [] };
    e.flats.push(r.flat.number);
    byUser.set(r.user.id, e);
  }
  return [...byUser].map(([id, e]) => ({ id, label: `${e.name} · ${e.flats.join(", ")}` }));
}

export interface FlatDetail {
  id: string;
  number: string;
  floor: { number: number; wing: { name: string } };
  configuration: string | null;
  areaSqFt: number | null;
}

/** Every flat with the attributes other charges target (configuration, area). */
export async function getFlatDetails(societyId: string): Promise<FlatDetail[]> {
  const flats = await prisma.flat.findMany({
    where: { societyId },
    select: {
      id: true, number: true, configuration: true, areaSqFt: true,
      floor: { select: { number: true, wing: { select: { name: true } } } },
    },
  });
  return flats
    .map((f) => ({
      id: f.id,
      number: f.number,
      floor: { number: f.floor.number, wing: { name: f.floor.wing.name } },
      configuration: f.configuration,
      areaSqFt: f.areaSqFt == null ? null : Number(f.areaSqFt),
    }))
    .sort(
      (a, b) =>
        a.floor.wing.name.localeCompare(b.floor.wing.name) ||
        a.floor.number - b.floor.number ||
        a.number.localeCompare(b.number, undefined, { numeric: true })
    );
}
