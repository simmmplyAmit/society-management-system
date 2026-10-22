"use client";

import { requestDocumentUpload, requestProofUpload, confirmDocumentUpload } from "@/actions/documents";
import { ALLOWED_TYPES, MAX_DOCUMENT_BYTES } from "@/lib/utils/documents";

export type AttachTarget = { expenseId: string } | { incomeId: string } | { claimId: string };

/** Why a file can't be uploaded, or null if it looks fine. */
export function fileProblem(f: File): string | null {
  if (!ALLOWED_TYPES[f.type]) return `${f.name}: only PDF, JPG, PNG or WebP files can be uploaded`;
  if (f.size > MAX_DOCUMENT_BYTES) return `${f.name}: files can be at most 10 MB`;
  return null;
}

/**
 * Upload files one by one and attach them to an expense or income entry:
 * ask for a signed link, PUT straight to storage, then confirm.
 */
export async function uploadAttachments(
  files: File[],
  target: AttachTarget,
  opts: { category: "BILL" | "OTHER"; titlePrefix: string }
): Promise<{ uploaded: number; errors: string[] }> {
  let uploaded = 0;
  const errors: string[] = [];
  for (const file of files) {
    try {
      const fd = new FormData();
      fd.set("title", `${opts.titlePrefix} – ${file.name.replace(/\.[^.]+$/, "")}`.slice(0, 120));
      fd.set("category", opts.category);
      fd.set("visibility", "COMMITTEE");
      fd.set("fileName", file.name);
      fd.set("mimeType", file.type);
      fd.set("sizeBytes", String(file.size));
      let r;
      if ("claimId" in target) {
        // A resident's proof for their own payment report
        const proof = new FormData();
        proof.set("claimId", target.claimId);
        proof.set("fileName", file.name);
        proof.set("mimeType", file.type);
        proof.set("sizeBytes", String(file.size));
        r = await requestProofUpload(proof);
      } else {
        fd.set("expenseId" in target ? "expenseId" : "incomeId", "expenseId" in target ? target.expenseId : target.incomeId);
        r = await requestDocumentUpload(fd);
      }
      if (!("success" in r) || !r.success) {
        errors.push(`${file.name}: ${(r as { error: string }).error}`);
        continue;
      }
      const put = await fetch(r.uploadUrl, { method: "PUT", headers: { "Content-Type": r.contentType }, body: file });
      if (!put.ok) {
        errors.push(`${file.name}: the upload failed`);
        continue;
      }
      const c = await confirmDocumentUpload(r.documentId);
      if ("error" in c && c.error) errors.push(`${file.name}: ${c.error}`);
      else uploaded++;
    } catch {
      errors.push(`${file.name}: the upload failed`);
    }
  }
  return { uploaded, errors };
}
