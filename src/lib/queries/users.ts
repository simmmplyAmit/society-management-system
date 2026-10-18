// Server-only data access. Deliberately NOT a "use server" file: exports here must
// never become client-callable endpoints. Pass a societyId taken from the session.
import { prisma } from "@/lib/prisma";

export async function getSocietyUsers(societyId: string) {
  return prisma.user.findMany({
    where: { societyId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
      flatResidents: {
        include: {
          flat: {
            include: {
              floor: { include: { wing: { select: { name: true } } } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}
