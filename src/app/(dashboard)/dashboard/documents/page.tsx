import Link from "next/link";
import { requireRole } from "@/lib/session";
import { COMMITTEE_ROLES, getCategoryCounts, getStorageUsed, listDocuments, quotaBytes } from "@/lib/queries/documents";
import { CATEGORIES, CATEGORY_LABELS, formatBytes } from "@/lib/utils/documents";
import { DocumentsList } from "@/components/documents/documents-list";
import { DocumentUploadForm } from "@/components/documents/upload-form";
import { ToolSection } from "@/components/ui/tool-section";
import { storageConfigured } from "@/lib/storage";
import { Upload } from "lucide-react";
import type { DocumentCategory } from "@prisma/client";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const session = await requireRole(["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"]);
  const { role, societyId, id: userId } = session.user;
  const sp = await searchParams;
  const category = CATEGORIES.includes(sp.cat as DocumentCategory) ? (sp.cat as DocumentCategory) : undefined;
  const isCommittee = COMMITTEE_ROLES.includes(role);
  const isManager = role === "ADMIN" || role === "TREASURER";

  const [rows, counts, used] = await Promise.all([
    listDocuments(societyId!, role, category),
    getCategoryCounts(societyId!, role),
    isCommittee ? getStorageUsed(societyId!) : Promise.resolve(0),
  ]);
  const total = Object.values(counts).reduce((n, c) => n + (c ?? 0), 0);
  const docs = rows.map((d) => ({
    id: d.id, title: d.title, category: d.category, visibility: d.visibility, fileName: d.fileName,
    mimeType: d.mimeType, sizeBytes: d.sizeBytes, expiresOn: d.expiresOn, retainUntil: d.retainUntil,
    createdAt: d.createdAt, uploadedByName: d.uploadedBy.name,
    canDelete: isManager || d.uploadedById === userId,
  }));
  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset ${active ? "bg-primary text-primary-foreground ring-primary" : "bg-card text-muted-foreground ring-border hover:bg-muted"}`;

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold">Documents</h2>
      <p className="-mt-3 text-sm text-muted-foreground">
        {isCommittee
          ? "Bills, tax receipts, agreements, minutes and more. Mark a file for all residents when it should be shared."
          : "Documents your committee has shared with residents."}
      </p>

      {isCommittee && !storageConfigured() && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-600/20">
          File storage isn&apos;t set up yet, so uploads will fail until the storage keys are added (see docs/DOCUMENT-STORAGE.md).
        </p>
      )}

      {isCommittee && (
        <ToolSection title="Upload a document" description="PDF or photo, up to 10 MB" icon={Upload}>
          <DocumentUploadForm defaultCategory={category} />
        </ToolSection>
      )}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Link href="/dashboard/documents" className={chip(!category)}>All ({total})</Link>
        {CATEGORIES.filter((c) => (counts[c] ?? 0) > 0 || c === category).map((c) => (
          <Link key={c} href={`/dashboard/documents?cat=${c}`} className={chip(c === category)}>
            {CATEGORY_LABELS[c]} ({counts[c] ?? 0})
          </Link>
        ))}
      </div>

      <DocumentsList docs={docs} now={new Date()} />

      {isCommittee && (
        <p className="text-center text-xs text-muted-foreground">
          Storage used: {formatBytes(used)} of {formatBytes(quotaBytes())}
        </p>
      )}
    </div>
  );
}
