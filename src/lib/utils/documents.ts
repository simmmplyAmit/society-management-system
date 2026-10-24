// Pure rules for uploaded documents: allowed files, categories, retention and file sniffing.

import type { DocumentCategory, DocumentVisibility } from "@prisma/client";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB
export const EXPIRY_WARN_DAYS = 60;
export const TAX_RETENTION_YEARS = 8;

/** Allowed file types and the extension we store them under (never the user's extension). */
export const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  BILL: "Bills",
  TAX_RECEIPT: "Tax receipts",
  AGREEMENT: "Agreements & contracts",
  INSURANCE: "Insurance",
  MINUTES: "Meeting minutes",
  BYLAWS: "Bylaws & rules",
  NOTICE: "Notices",
  AUDIT: "Audit & statements",
  PAYMENT_PROOF: "Payment proof",
  COMPLAINT_PHOTO: "Complaint photo",
  OTHER: "Other",
};

/** Categories a committee member can choose for a library document (proofs are attached to reports instead). */
/** Attached to a record (payment report, complaint) instead of living in the library. */
export const ATTACHMENT_CATEGORIES = ["PAYMENT_PROOF", "COMPLAINT_PHOTO"] as const;
export type LibraryCategory = Exclude<DocumentCategory, (typeof ATTACHMENT_CATEGORIES)[number]>;
export const CATEGORIES = (Object.keys(CATEGORY_LABELS) as DocumentCategory[]).filter(
  (c): c is LibraryCategory => !(ATTACHMENT_CATEGORIES as readonly string[]).includes(c)
);

export const MAX_PROOFS_PER_CLAIM = 3;

/** Categories that normally carry an expiry or renewal date. */
export const EXPIRING_CATEGORIES: DocumentCategory[] = ["AGREEMENT", "INSURANCE"];

/** Kept for the retention period and not deletable before then. */
const RETAINED: DocumentCategory[] = ["TAX_RECEIPT", "AUDIT"];

/** What the upload form pre-selects. Only the person uploading can widen who sees a file. */
export function defaultVisibility(category: DocumentCategory): DocumentVisibility {
  return category === "MINUTES" || category === "BYLAWS" || category === "NOTICE" ? "RESIDENTS" : "COMMITTEE";
}

export function retainUntil(category: DocumentCategory, from: Date): Date | null {
  if (!RETAINED.includes(category)) return null;
  const d = new Date(from);
  d.setFullYear(d.getFullYear() + TAX_RETENTION_YEARS);
  return d;
}

/** Display-safe file name: no path, no control characters, bounded length. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f"<>:|?*]/g, "").trim();
  if (!clean) return "document";
  if (clean.length <= 120) return clean;
  const dot = clean.lastIndexOf(".");
  const ext = dot > 0 && clean.length - dot <= 8 ? clean.slice(dot) : "";
  return clean.slice(0, 120 - ext.length) + ext;
}

/** Identify the real file type from its first bytes. Returns null for anything not allowed. */
export function sniffMime(head: Uint8Array): string | null {
  const starts = (sig: number[], at = 0) => sig.every((b, i) => head[at + i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46])) return "application/pdf"; // %PDF
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp"; // RIFF....WEBP
  return null;
}

export type ExpiryState = "expired" | "soon" | null;

export function expiryState(expiresOn: Date | null, now: Date): ExpiryState {
  if (!expiresOn) return null;
  const days = (expiresOn.getTime() - now.getTime()) / 86_400_000;
  if (days < 0) return "expired";
  return days <= EXPIRY_WARN_DAYS ? "soon" : null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;

/**
 * Tidy tags for search: lowercase, letters/digits/spaces/dashes only, no duplicates, at most 10.
 * Over-long tags are cut rather than rejected so a paste never fails.
 */
export function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const t = item
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\s&.-]/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_TAG_LENGTH)
      .trim();
    if (t && !out.includes(t)) out.push(t);
    if (out.length === MAX_TAGS) break;
  }
  return out;
}
