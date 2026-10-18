// Server-only. Callers MUST have verified the SUPER_ADMIN role first.
import { prisma } from "@/lib/prisma";

export async function getAllSocieties() {
  return prisma.society.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      city: true,
      isActive: true,
      createdAt: true,
      _count: { select: { users: true } },
    },
  });
}

/** Read-only overview of one society for the platform team. */
export async function getSocietyOverview(societyId: string) {
  const [society, users, flats, wings, paymentsByStatus, expenses] = await Promise.all([
    prisma.society.findUnique({
      where: { id: societyId },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        upiId: true,
        hasWings: true,
        isActive: true,
        createdAt: true,
      },
    }),
    prisma.user.findMany({
      where: { societyId },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, role: true, isActive: true },
    }),
    prisma.flat.count({ where: { societyId } }),
    prisma.wing.count({ where: { societyId, name: { not: "_default_" } } }),
    prisma.maintenancePayment.groupBy({
      by: ["status"],
      where: { societyId },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({ where: { societyId }, _sum: { amount: true } }),
  ]);

  if (!society) return null;

  return {
    society,
    users,
    flats,
    wings,
    payments: paymentsByStatus.map((p) => ({
      status: p.status,
      count: p._count._all,
      total: Number(p._sum.amount ?? 0),
    })),
    expenseTotal: Number(expenses._sum.amount ?? 0),
  };
}
