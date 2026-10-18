// Server-only data access. Deliberately NOT a "use server" file: exports here must
// never become client-callable endpoints. Pass a societyId taken from the session.
import { prisma } from "@/lib/prisma";

export async function getSociety(societyId: string) {
  return prisma.society.findUnique({
    where: { id: societyId },
  });
}
