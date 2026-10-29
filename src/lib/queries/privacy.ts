// Server-only data access (not a "use server" file).
import { prisma } from "@/lib/prisma";

export async function getMyDataRequests(societyId: string, userId: string) {
  return prisma.dataRequest.findMany({
    where: { societyId, userId },
    select: { id: true, type: true, note: true, status: true, resolutionNote: true, createdAt: true, handledAt: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

/** Open requests from residents, for an admin to handle. */
export async function getOpenDataRequests(societyId: string) {
  return prisma.dataRequest.findMany({
    where: { societyId, status: "OPEN" },
    select: {
      id: true, type: true, note: true, createdAt: true,
      user: { select: { id: true, name: true, role: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
}
