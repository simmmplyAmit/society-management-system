"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { COMMITTEE_ROLES } from "@/lib/queries/documents";
import { notifyComplaint } from "@/lib/notify/community";
import {
  COMPLAINT_BODY_MAX,
  COMPLAINT_CATEGORIES,
  COMPLAINT_TITLE_MAX,
  MAX_OPEN_COMPLAINTS,
  STATUS_LABELS,
  UPDATE_BODY_MAX,
  canTransition,
  cleanText,
  withinReopenWindow,
} from "@/lib/utils/community";
import type { ComplaintStatus } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const MEMBERS = ["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"] as const;
const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

const raiseSchema = z.object({
  category: z.enum(COMPLAINT_CATEGORIES as [string, ...string[]]),
  title: z.string().trim().min(3, "Give the complaint a short title").max(COMPLAINT_TITLE_MAX),
  description: z
    .string()
    .transform(cleanText)
    .pipe(z.string().min(5, "Describe the problem").max(COMPLAINT_BODY_MAX, `Keep it under ${COMPLAINT_BODY_MAX} characters`)),
  priority: z.enum(["NORMAL", "URGENT"]).default("NORMAL"),
  flatId: z.string().max(40).optional(),
});

const textSchema = z.string().transform(cleanText).pipe(z.string().min(1, "Write a message").max(UPDATE_BODY_MAX, `Keep it under ${UPDATE_BODY_MAX} characters`));

function paths(id?: string) {
  revalidatePath("/dashboard/complaints");
  if (id) revalidatePath(`/dashboard/complaints/${id}`);
  revalidatePath("/dashboard");
}

/** Anyone in the society can raise a complaint; it is visible to them and the committee only. */
export async function raiseComplaint(formData: FormData) {
  const session = await requireRole([...MEMBERS]);
  const { id: userId, societyId } = session.user;
  if (!societyId) return { error: "No society found" };

  const parsed = raiseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  let flatId: string | null = null;
  if (d.flatId) {
    // Only a flat the person is linked to
    const link = await prisma.flatResident.findFirst({
      where: { userId, flatId: d.flatId, flat: { societyId } },
      select: { flatId: true },
    });
    if (!link) return { error: "Choose one of your own flats, or leave it empty" };
    flatId = link.flatId;
  }

  const open = await prisma.complaint.count({ where: { societyId, raisedById: userId, status: { in: ["OPEN", "IN_PROGRESS"] } } });
  if (open >= MAX_OPEN_COMPLAINTS) return { error: "You have too many open complaints. Wait for some to be resolved" };

  const created = await prisma.complaint.create({
    data: {
      societyId,
      raisedById: userId,
      flatId,
      category: d.category as (typeof COMPLAINT_CATEGORIES)[number],
      title: d.title,
      description: d.description,
      priority: d.priority,
    },
    select: { id: true },
  });
  await notifyComplaint({
    societyId, complaintId: created.id, title: d.title, kind: "raised", actorId: userId,
    actorName: session.user.name ?? "A resident", detail: d.description, raisedById: userId,
  });
  paths();
  return { success: true as const, complaintId: created.id };
}

async function loadFor(societyId: string, userId: string, role: string, complaintId: string) {
  const c = await prisma.complaint.findFirst({
    where: { id: complaintId, societyId },
    select: {
      id: true, title: true, status: true, raisedById: true, assignedToId: true, resolvedAt: true, closedAt: true,
    },
  });
  if (!c) return null;
  const committee = COMMITTEE_ROLES.includes(role as never);
  const isRaiser = c.raisedById === userId;
  if (!committee && !isRaiser) return null; // not theirs: behaves as if it doesn't exist
  return { c, committee, isRaiser };
}

/** A reply on the thread. Only the committee can mark a note internal (hidden from the resident). */
export async function addComplaintUpdate(complaintId: string, formData: FormData) {
  const session = await requireRole([...MEMBERS]);
  const { id: userId, societyId, role } = session.user;
  if (!societyId) return { error: "No society found" };

  const body = textSchema.safeParse(formData.get("body") ?? "");
  if (!body.success) return { error: body.error.issues[0].message };

  const found = await loadFor(societyId, userId, role, complaintId);
  if (!found) return { error: "Complaint not found" };
  if (found.c.status === "CLOSED") return { error: "This complaint is closed. Reopen it to add a message" };

  const internal = found.committee && formData.get("internal") === "on";
  await prisma.complaint.update({
    where: { id: found.c.id },
    data: { updates: { create: { societyId, authorId: userId, kind: "COMMENT", body: body.data, internal } } },
  });

  // The resident hears about committee replies (never internal notes)
  if (found.committee && !found.isRaiser && !internal) {
    await notifyComplaint({
      societyId, complaintId: found.c.id, title: found.c.title, kind: "reply", actorId: userId,
      actorName: session.user.name ?? "Committee", detail: body.data, raisedById: found.c.raisedById,
    });
  }
  paths(found.c.id);
  return { success: true as const };
}

/**
 * Committee: OPEN → IN_PROGRESS → RESOLVED (a resolution note is required).
 * The resident can confirm a resolved complaint (closing it) or reopen it within 14 days.
 */
export async function changeComplaintStatus(complaintId: string, status: string, note?: string) {
  const session = await requireRole([...MEMBERS]);
  const { id: userId, societyId, role } = session.user;
  if (!societyId) return { error: "No society found" };
  if (!STATUSES.includes(status as never)) return { error: "Unknown status" };
  const to = status as ComplaintStatus;

  const found = await loadFor(societyId, userId, role, complaintId);
  if (!found) return { error: "Complaint not found" };
  const from = found.c.status;

  const asCommittee = found.committee && canTransition(from, to, "committee");
  const asRaiser = found.isRaiser && canTransition(from, to, "raiser");
  if (!asCommittee && !asRaiser) return { error: `A ${STATUS_WORD[from]} complaint can't be moved to ${STATUS_WORD[to]}` };

  const now = new Date();
  if (to === "OPEN" && !asCommittee && !withinReopenWindow(from === "CLOSED" ? found.c.closedAt : found.c.resolvedAt, now)) {
    return { error: "It's too long since this was resolved. Please raise a new complaint" };
  }

  let text = "";
  if (note !== undefined && note.trim() !== "") {
    const t = textSchema.safeParse(note);
    if (!t.success) return { error: t.error.issues[0].message };
    text = t.data;
  }
  if (to === "RESOLVED" && !text) return { error: "Say what was done to resolve it" };

  // Guarded on the current status so two people can't both move it
  const moved = await prisma.$transaction(async (tx) => {
    const r = await tx.complaint.updateMany({
      where: { id: found.c.id, societyId, status: from },
      data: {
        status: to,
        ...(to === "RESOLVED" ? { resolutionNote: text, resolvedAt: now, closedAt: null } : {}),
        ...(to === "CLOSED" ? { closedAt: now } : {}),
        ...(to === "OPEN" || to === "IN_PROGRESS" ? { closedAt: null, ...(to === "OPEN" ? { resolvedAt: null } : {}) } : {}),
      },
    });
    if (r.count !== 1) return false;
    await tx.complaintUpdate.create({
      data: {
        societyId, complaintId: found.c.id, authorId: userId, kind: "STATUS",
        body: text || `Marked ${STATUS_LABELS[to].toLowerCase()}`, fromStatus: from, toStatus: to,
      },
    });
    return true;
  });
  if (!moved) return { error: "Someone just changed this complaint. Refresh to see the latest" };

  if (found.committee && !found.isRaiser) {
    await notifyComplaint({
      societyId, complaintId: found.c.id, title: found.c.title, kind: "status", actorId: userId,
      actorName: session.user.name ?? "Committee", detail: `Status: ${STATUS_LABELS[to]}${text ? `. ${text}` : ""}`,
      raisedById: found.c.raisedById,
    });
  }
  paths(found.c.id);
  return { success: true as const, status: to };
}

const STATUS_WORD: Record<ComplaintStatus, string> = {
  OPEN: "open",
  IN_PROGRESS: "in-progress",
  RESOLVED: "resolved",
  CLOSED: "closed",
};

/** Committee hands a complaint to one of its members (or clears the assignment with an empty id). */
export async function assignComplaint(complaintId: string, assigneeId: string) {
  const session = await requireRole(["ADMIN", "SECRETARY", "TREASURER"]);
  const { id: userId } = session.user;
  const societyId = session.user.societyId!;

  const complaint = await prisma.complaint.findFirst({ where: { id: complaintId, societyId }, select: { id: true, status: true } });
  if (!complaint) return { error: "Complaint not found" };
  if (complaint.status === "CLOSED") return { error: "This complaint is closed" };

  let name = "";
  if (assigneeId) {
    const a = await prisma.user.findFirst({
      where: { id: assigneeId, societyId, isActive: true, role: { in: ["ADMIN", "SECRETARY", "TREASURER"] } },
      select: { name: true },
    });
    if (!a) return { error: "Choose a committee member" };
    name = a.name;
  }

  await prisma.complaint.update({
    where: { id: complaint.id },
    data: {
      assignedToId: assigneeId || null,
      updates: { create: { societyId, authorId: userId, kind: "ASSIGNED", body: assigneeId ? `Assigned to ${name}` : "Assignment cleared" } },
    },
  });
  paths(complaint.id);
  return { success: true as const };
}
