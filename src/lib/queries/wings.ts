// Server-only data access. Deliberately NOT a "use server" file: exports here must
// never become client-callable endpoints. Pass a societyId taken from the session.
import { prisma } from "@/lib/prisma";

export async function getWingsWithStructure(societyId: string) {
  return prisma.wing.findMany({
    where: { societyId },
    include: {
      floors: {
        orderBy: { number: "asc" },
        include: {
          flats: {
            orderBy: { number: "asc" },
            include: {
              residents: {
                include: { user: { select: { id: true, name: true, role: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}
