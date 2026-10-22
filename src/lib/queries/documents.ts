// Server-only data access (not a "use server" file). Pass a societyId taken from the session.
import { prisma } from "@/lib/prisma";
import { deleteObject, storageConfigured } from "@/lib/storage";
import type { DocumentCategory, Role } from "@prisma/client";

export const COMMITTEE_ROLES: Role[] = ["ADMIN", "SECRETARY", "TREASURER"];
const DAY_MS = 86_400_000;
export const DELETED_FILE_KEEP_DAYS = 30;
export const PENDING_UPLOAD_MAX_AGE_MS = 60 * 60 * 1000;
export const DEFAULT_QUOTA_MB = 1024;

export function quotaBytes(): number {
  const mb = Number(process.env.DOCUMENT_QUOTA_MB);
  return (Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_QUOTA_MB) * 1024 * 1024;
}

/** What this role may see: committee sees everything, residents only what was shared with them. */
export function visibleTo(role: Role) {
  return COMMITTEE_ROLES.includes(role) ? {} : { visibility: "RESIDENTS" as const };
}

export async function listDocuments(societyId: string, role: Role, category?: DocumentCategory) {
  return prisma.document.findMany({
    where: { societyId, status: "READY", ...visibleTo(role), ...(category ? { category } : {}) },
    select: {
      id: true, title: true, category: true, visibility: true, fileName: true, mimeType: true, sizeBytes: true,
      expiresOn: true, retainUntil: true, createdAt: true, uploadedById: true,
      uploadedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCategoryCounts(societyId: string, role: Role) {
  const rows = await prisma.document.groupBy({
    by: ["category"],
    where: { societyId, status: "READY", ...visibleTo(role) },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.category, r._count._all])) as Partial<Record<DocumentCategory, number>>;
}

/** Bytes used by files that still exist (pending uploads count, so they can't be used to overshoot). */
export async function getStorageUsed(societyId: string): Promise<number> {
  const r = await prisma.document.aggregate({
    where: { societyId, status: { in: ["PENDING", "READY"] } },
    _sum: { sizeBytes: true },
  });
  return r._sum.sizeBytes ?? 0;
}

/** The document, only if this person may open it. */
export async function getDocumentForViewer(societyId: string, role: Role, id: string) {
  return prisma.document.findFirst({
    where: { id, societyId, status: "READY", ...visibleTo(role) },
    select: { id: true, storageKey: true, fileName: true, mimeType: true },
  });
}

/**
 * Daily housekeeping: drop uploads that were never confirmed, and remove files that were
 * deleted more than 30 days ago. Rows stay (without the file) as a record of who deleted what.
 */
export async function cleanupDocuments(now = new Date()) {
  if (!storageConfigured()) return { skipped: true as const };
  let abandoned = 0;
  let purged = 0;

  const stale = await prisma.document.findMany({
    where: { status: "PENDING", createdAt: { lt: new Date(now.getTime() - PENDING_UPLOAD_MAX_AGE_MS) } },
    select: { id: true, storageKey: true },
    take: 200,
  });
  for (const d of stale) {
    try {
      await deleteObject(d.storageKey); // deleting a missing key is fine
      await prisma.document.deleteMany({ where: { id: d.id, status: "PENDING" } });
      abandoned++;
    } catch (err) {
      console.error("[documents cleanup] abandoned upload", d.id, err);
    }
  }

  const old = await prisma.document.findMany({
    where: {
      status: "DELETED",
      purgedAt: null,
      deletedAt: { lt: new Date(now.getTime() - DELETED_FILE_KEEP_DAYS * DAY_MS) },
    },
    select: { id: true, storageKey: true },
    take: 200,
  });
  for (const d of old) {
    try {
      await deleteObject(d.storageKey);
      await prisma.document.updateMany({ where: { id: d.id, purgedAt: null }, data: { purgedAt: now } });
      purged++;
    } catch (err) {
      console.error("[documents cleanup] purge", d.id, err);
    }
  }
  return { skipped: false as const, abandoned, purged };
}
