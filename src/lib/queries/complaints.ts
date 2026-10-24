// Server-only data access (not a "use server" file). Pass a societyId taken from the session.
import { prisma } from "@/lib/prisma";
import { COMMITTEE_ROLES } from "@/lib/queries/documents";
import { AUTO_CLOSE_AFTER_DAYS } from "@/lib/utils/community";
import type { ComplaintStatus, Role } from "@prisma/client";

/** Residents see only their own complaints; the committee sees everyone's. */
export function complaintScope(societyId: string, role: Role, userId: string) {
  return COMMITTEE_ROLES.includes(role) ? { societyId } : { societyId, raisedById: userId };
}

export async function listComplaints(
  societyId: string,
  role: Role,
  userId: string,
  filter: { status?: ComplaintStatus | "ACTIVE"; assignedToId?: string } = {}
) {
  const status =
    filter.status === "ACTIVE" ? { status: { in: ["OPEN", "IN_PROGRESS"] as ComplaintStatus[] } } : filter.status ? { status: filter.status } : {};
  return prisma.complaint.findMany({
    where: { ...complaintScope(societyId, role, userId), ...status, ...(filter.assignedToId ? { assignedToId: filter.assignedToId } : {}) },
    select: {
      id: true, title: true, category: true, priority: true, status: true, createdAt: true, updatedAt: true,
      raisedBy: { select: { name: true } },
      assignedTo: { select: { name: true } },
      flat: { select: { number: true, floor: { select: { number: true, wing: { select: { name: true } } } } } },
    },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });
}

export async function getComplaintCounts(societyId: string, role: Role, userId: string) {
  const rows = await prisma.complaint.groupBy({
    by: ["status"],
    where: complaintScope(societyId, role, userId),
    _count: { _all: true },
  });
  const c = Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Partial<Record<ComplaintStatus, number>>;
  return { open: c.OPEN ?? 0, inProgress: c.IN_PROGRESS ?? 0, resolved: c.RESOLVED ?? 0, closed: c.CLOSED ?? 0 };
}

/** One complaint with its thread. Committee-only notes are removed for the resident. */
export async function getComplaint(societyId: string, role: Role, userId: string, id: string) {
  const committee = COMMITTEE_ROLES.includes(role);
  return prisma.complaint.findFirst({
    where: { id, ...complaintScope(societyId, role, userId) },
    include: {
      raisedBy: { select: { id: true, name: true, phone: true } },
      assignedTo: { select: { id: true, name: true } },
      flat: { select: { number: true, floor: { select: { number: true, wing: { select: { name: true } } } } } },
      updates: {
        where: committee ? {} : { internal: false },
        include: { author: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
      documents: {
        where: { status: "READY" },
        select: { id: true, fileName: true, mimeType: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

/** Committee members a complaint can be assigned to. */
export async function getAssignees(societyId: string) {
  return prisma.user.findMany({
    where: { societyId, isActive: true, role: { in: ["ADMIN", "SECRETARY", "TREASURER"] } },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}

/** The flats a user is linked to, for the "which flat" choice on a new complaint. */
export async function getMyFlatOptions(societyId: string, userId: string) {
  const rows = await prisma.flatResident.findMany({
    where: { userId, flat: { societyId } },
    select: { flat: { select: { id: true, number: true, floor: { select: { number: true, wing: { select: { name: true } } } } } } },
  });
  return rows.map((r) => r.flat);
}

/** Daily: a complaint resolved a week ago that the resident hasn't reopened is closed. */
export async function autoCloseResolvedComplaints(now = new Date()): Promise<number> {
  const r = await prisma.complaint.updateMany({
    where: { status: "RESOLVED", resolvedAt: { lt: new Date(now.getTime() - AUTO_CLOSE_AFTER_DAYS * 86_400_000) } },
    data: { status: "CLOSED", closedAt: now },
  });
  return r.count;
}
