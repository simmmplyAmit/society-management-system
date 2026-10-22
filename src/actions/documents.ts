"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { deleteObject, inspectObject, signUpload, StorageNotConfiguredError } from "@/lib/storage";
import { getStorageUsed, quotaBytes } from "@/lib/queries/documents";
import {
  ALLOWED_TYPES,
  CATEGORIES,
  MAX_DOCUMENT_BYTES,
  MAX_PROOFS_PER_CLAIM,
  normalizeTags,
  retainUntil,
  safeFileName,
  sniffMime,
} from "@/lib/utils/documents";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { DocumentCategory } from "@prisma/client";

const UPLOADERS = ["ADMIN", "SECRETARY", "TREASURER"] as const;
const MEMBERS = ["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"] as const;

const requestSchema = z.object({
  title: z.string().trim().min(2, "Give the document a title").max(120),
  category: z.enum(CATEGORIES as [string, ...string[]]),
  visibility: z.enum(["COMMITTEE", "RESIDENTS"]).default("COMMITTEE"),
  fileName: z.string().min(1).max(255),
  mimeType: z.string(),
  sizeBytes: z.coerce.number().int().positive("The file is empty").max(MAX_DOCUMENT_BYTES, "Files can be at most 10 MB"),
  expiresOn: z.string().optional(),
  tags: z.string().max(1000).optional(), // JSON array of strings
  // Attach to an expense or an income entry (admin/treasurer only)
  expenseId: z.string().max(40).optional(),
  incomeId: z.string().max(40).optional(),
});

function paths() {
  revalidatePath("/dashboard/documents");
}

const NOT_CONFIGURED = "File storage isn't set up yet. Ask the site owner to add the storage keys";

/** Step 1: validate the file's details, reserve a record and return a one-off upload link. */
export async function requestDocumentUpload(formData: FormData) {
  const session = await requireRole([...UPLOADERS]);
  const societyId = session.user.societyId!;

  const parsed = requestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const ext = ALLOWED_TYPES[d.mimeType];
  if (!ext) return { error: "Only PDF, JPG, PNG or WebP files can be uploaded" };

  const expenseId = d.expenseId || null;
  const incomeId = d.incomeId || null;
  if (expenseId || incomeId) {
    if (expenseId && incomeId) return { error: "Attach a file to one entry at a time" };
    if (session.user.role !== "ADMIN" && session.user.role !== "TREASURER") {
      return { error: "Only an admin or the treasurer can attach files to expenses and income" };
    }
    // The entry must belong to this society
    const target = expenseId
      ? await prisma.expense.findFirst({ where: { id: expenseId, societyId }, select: { id: true } })
      : await prisma.income.findFirst({ where: { id: incomeId!, societyId }, select: { id: true } });
    if (!target) return { error: "That entry was not found" };
  }

  let tags: string[] = [];
  if (d.tags) {
    try {
      tags = normalizeTags(JSON.parse(d.tags));
    } catch {
      return { error: "Invalid tags" };
    }
  }

  let expiresOn: Date | null = null;
  if (d.expiresOn) {
    expiresOn = new Date(d.expiresOn);
    if (Number.isNaN(expiresOn.getTime())) return { error: "Enter a valid expiry date" };
  }

  const category = d.category as (typeof CATEGORIES)[number];
  return issueUpload({
    societyId, userId: session.user.id, title: d.title, category, visibility: d.visibility,
    fileName: d.fileName, mimeType: d.mimeType, ext, sizeBytes: d.sizeBytes, tags, expiresOn,
    expenseId, incomeId, claimId: null, source: "requestDocumentUpload",
  });
}

/** Quota check, signed link and the pending record: shared by every kind of upload. */
async function issueUpload(o: {
  societyId: string;
  userId: string;
  title: string;
  category: DocumentCategory;
  visibility: "COMMITTEE" | "RESIDENTS";
  fileName: string;
  mimeType: string;
  ext: string;
  sizeBytes: number;
  tags: string[];
  expiresOn: Date | null;
  expenseId: string | null;
  incomeId: string | null;
  claimId: string | null;
  source: string;
}) {
  if ((await getStorageUsed(o.societyId)) + o.sizeBytes > quotaBytes()) {
    return { error: "Your society's storage is full. Delete old files or ask for more space" };
  }

  const id = randomUUID();
  const storageKey = `societies/${o.societyId}/${id}/${randomUUID()}.${o.ext}`;

  let uploadUrl: string;
  try {
    uploadUrl = await signUpload(storageKey, o.mimeType, o.sizeBytes);
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) return { error: NOT_CONFIGURED };
    console.error(`[${o.source}] sign failed:`, err);
    return { error: "Could not start the upload. Please try again" };
  }

  await prisma.document.create({
    data: {
      id,
      societyId: o.societyId,
      title: o.title,
      category: o.category,
      visibility: o.visibility,
      status: "PENDING",
      storageKey,
      fileName: safeFileName(o.fileName),
      mimeType: o.mimeType,
      sizeBytes: o.sizeBytes,
      tags: o.tags,
      expenseId: o.expenseId,
      incomeId: o.incomeId,
      claimId: o.claimId,
      expiresOn: o.expiresOn,
      retainUntil: retainUntil(o.category, new Date()),
      uploadedById: o.userId,
    },
  });
  return { success: true as const, documentId: id, uploadUrl, contentType: o.mimeType };
}

const proofSchema = z.object({
  claimId: z.string().min(1).max(40),
  fileName: z.string().min(1).max(255),
  mimeType: z.string(),
  sizeBytes: z.coerce.number().int().positive("The file is empty").max(MAX_DOCUMENT_BYTES, "Files can be at most 10 MB"),
});

/**
 * A resident attaches proof (a UPI screenshot or receipt) to their own payment report. Only the
 * resident who made the report can add to it, and only while it is awaiting verification.
 */
export async function requestProofUpload(formData: FormData) {
  const session = await requireRole(["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"]);
  const { id: userId, societyId } = session.user;
  if (!societyId) return { error: "No society found" };

  const parsed = proofSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const ext = ALLOWED_TYPES[d.mimeType];
  if (!ext) return { error: "Only PDF, JPG, PNG or WebP files can be uploaded" };

  const claim = await prisma.paymentClaim.findFirst({
    where: { id: d.claimId, societyId, userId, status: "SUBMITTED" },
    select: { id: true, utrNumber: true },
  });
  if (!claim) return { error: "That payment report was not found" };

  // Counts unconfirmed uploads too, so repeated requests can't pile up
  const existing = await prisma.document.count({
    where: { claimId: claim.id, societyId, status: { in: ["PENDING", "READY"] } },
  });
  if (existing >= MAX_PROOFS_PER_CLAIM) return { error: `You can attach at most ${MAX_PROOFS_PER_CLAIM} files to a report` };

  return issueUpload({
    societyId, userId, title: `Payment proof – ${claim.utrNumber}`, category: "PAYMENT_PROOF", visibility: "COMMITTEE",
    fileName: d.fileName, mimeType: d.mimeType, ext, sizeBytes: d.sizeBytes, tags: [], expiresOn: null,
    expenseId: null, incomeId: null, claimId: claim.id, source: "requestProofUpload",
  });
}

/** Step 2: after the browser uploaded, check what actually arrived and publish the document. */
export async function confirmDocumentUpload(documentId: string) {
  // Open to every society member: it only publishes a pending upload the caller themselves started
  const session = await requireRole([...MEMBERS]);
  const societyId = session.user.societyId!;

  const doc = await prisma.document.findFirst({
    where: { id: documentId, societyId, status: "PENDING", uploadedById: session.user.id },
    select: { id: true, storageKey: true, mimeType: true, sizeBytes: true },
  });
  if (!doc) return { error: "Upload not found" };

  let problem: string | null = null;
  try {
    const found = await inspectObject(doc.storageKey);
    if (!found) problem = "The upload didn't arrive. Please try again";
    else if (found.size !== doc.sizeBytes) problem = "The upload was incomplete. Please try again";
    else if (sniffMime(found.head) !== doc.mimeType) problem = "That file isn't really a PDF or image";
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) return { error: NOT_CONFIGURED };
    console.error("[confirmDocumentUpload] inspect failed:", err);
    return { error: "Could not check the upload. Please try again" };
  }

  if (problem) {
    await deleteObject(doc.storageKey).catch(() => {});
    await prisma.document.deleteMany({ where: { id: doc.id, societyId, status: "PENDING" } });
    return { error: problem };
  }

  // Guarded: only a still-pending record can be published, exactly once
  const r = await prisma.document.updateMany({
    where: { id: doc.id, societyId, status: "PENDING" },
    data: { status: "READY", confirmedAt: new Date() },
  });
  if (r.count !== 1) return { error: "Upload not found" };
  paths();
  return { success: true as const };
}

/** Soft delete. Tax and audit records can't be deleted until their retention period ends. */
export async function deleteDocument(documentId: string) {
  const session = await requireRole([...UPLOADERS]);
  const societyId = session.user.societyId!;
  const isManager = session.user.role === "ADMIN" || session.user.role === "TREASURER";

  const doc = await prisma.document.findFirst({
    where: { id: documentId, societyId, status: "READY" },
    select: { id: true, uploadedById: true, retainUntil: true },
  });
  if (!doc) return { error: "Document not found" };
  if (!isManager && doc.uploadedById !== session.user.id) {
    return { error: "Only an admin, the treasurer or the person who uploaded it can delete this" };
  }
  if (doc.retainUntil && doc.retainUntil.getTime() > Date.now()) {
    return { error: `This record must be kept until ${doc.retainUntil.toLocaleDateString("en-IN")}` };
  }

  const r = await prisma.document.updateMany({
    where: { id: doc.id, societyId, status: "READY" },
    data: { status: "DELETED", deletedAt: new Date(), deletedById: session.user.id },
  });
  if (r.count !== 1) return { error: "Document not found" };
  paths();
  return { success: true as const, error: undefined };
}

/** Replace a document's tags. Any committee member can tidy tags; they only affect search. */
export async function updateDocumentTags(documentId: string, formData: FormData) {
  const session = await requireRole([...UPLOADERS]);
  const societyId = session.user.societyId!;

  let tags: string[];
  try {
    tags = normalizeTags(JSON.parse(String(formData.get("tags") ?? "[]")));
  } catch {
    return { error: "Invalid tags" };
  }

  const r = await prisma.document.updateMany({
    where: { id: documentId, societyId, status: "READY" },
    data: { tags },
  });
  if (r.count !== 1) return { error: "Document not found" };
  paths();
  return { success: true as const, tags };
}
