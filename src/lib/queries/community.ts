// Server-only data access (not a "use server" file). Pass a societyId taken from the session.
import { prisma } from "@/lib/prisma";
import { COMMITTEE_ROLES } from "@/lib/queries/documents";
import type { PostCategory, Role } from "@prisma/client";

export const POSTS_PER_PAGE = 20;

/** The board: newest first. The committee also sees posts it hid (marked as hidden). */
export async function getPosts(societyId: string, role: Role, opts: { category?: PostCategory; take?: number } = {}) {
  const committee = COMMITTEE_ROLES.includes(role);
  return prisma.post.findMany({
    where: { societyId, ...(committee ? {} : { status: "ACTIVE" }), ...(opts.category ? { category: opts.category } : {}) },
    include: {
      author: { select: { id: true, name: true, role: true } },
      comments: {
        where: committee ? {} : { status: "ACTIVE" },
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
        take: 100,
      },
    },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? POSTS_PER_PAGE,
  });
}
