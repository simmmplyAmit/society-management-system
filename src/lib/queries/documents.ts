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

/**
 * What this person may see: the committee sees everything; others see what was shared with all
 * residents plus anything they uploaded themselves (their own payment proofs).
 */
export function visibleTo(role: Role, userId: string) {
  return COMMITTEE_ROLES.includes(role)
    ? {}
    : { OR: [{ visibility: "RESIDENTS" as const }, { uploadedById: userId }] };
}

/** The library lists real documents; payment proofs live on their payment reports. */
const LIBRARY = { category: { not: "PAYMENT_PROOF" as const } };

/** Tags in use (most used first) among the documents this role can see. */
export async function getTagCounts(societyId: string, role: Role, userId: string, limit = 50) {
  const rows = await prisma.document.findMany({
    where: { societyId, status: "READY", ...LIBRARY, ...visibleTo(role, userId) },
    select: { tags: true },
  });
  const counts = new Map<string, number>();
  for (const r of rows) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}

export interface DocumentFilter {
  category?: DocumentCategory;
  /** Exact tag (lowercase). */
  tag?: string;
  /** Free text: matches title, file name or any tag containing it. */
  q?: string;
}

export async function listDocuments(societyId: string, role: Role, userId: string, filter: DocumentFilter = {}) {
  const { category, tag } = filter;
  const q = filter.q?.trim().toLowerCase().slice(0, 60);
  const search = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { fileName: { contains: q, mode: "insensitive" as const } },
          // tags are stored lowercase, so match every tag that contains the text
          { tags: { hasSome: (await getTagCounts(societyId, role, userId, 500)).map((t) => t.tag).filter((t) => t.includes(q)) } },
        ],
      }
    : {};
  return prisma.document.findMany({
    where: {
      societyId,
      status: "READY",
      category: category ?? LIBRARY.category,
      ...(tag ? { tags: { has: tag } } : {}),
      // two separate OR groups (who may see it, and what matches the text), so combine with AND
      AND: [visibleTo(role, userId), search],
    },
    select: {
      id: true, title: true, category: true, visibility: true, tags: true, fileName: true, mimeType: true, sizeBytes: true,
      expiresOn: true, retainUntil: true, createdAt: true, uploadedById: true,
      uploadedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCategoryCounts(societyId: string, role: Role, userId: string) {
  const rows = await prisma.document.groupBy({
    by: ["category"],
    where: { societyId, status: "READY", ...LIBRARY, ...visibleTo(role, userId) },
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
export async function getDocumentForViewer(societyId: string, role: Role, userId: string, id: string) {
  return prisma.document.findFirst({
    where: { id, societyId, status: "READY", ...visibleTo(role, userId) },
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
