import Link from "next/link";
import { requireRole } from "@/lib/session";
import { COMMITTEE_ROLES, getCategoryCounts, getStorageUsed, getTagCounts, listDocuments, quotaBytes } from "@/lib/queries/documents";
import { CATEGORIES, CATEGORY_LABELS, formatBytes, normalizeTags } from "@/lib/utils/documents";
import { DocumentsList } from "@/components/documents/documents-list";
import { DocumentUploadForm } from "@/components/documents/upload-form";
import { ToolSection } from "@/components/ui/tool-section";
import { storageConfigured } from "@/lib/storage";
import { Search, Upload, X } from "lucide-react";
import type { DocumentCategory } from "@prisma/client";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; q?: string; tag?: string }>;
}) {
  const session = await requireRole(["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"]);
  const { role, societyId, id: userId } = session.user;
  const sp = await searchParams;
  const category = CATEGORIES.includes(sp.cat as DocumentCategory) ? (sp.cat as DocumentCategory) : undefined;
  const q = (sp.q ?? "").trim().slice(0, 60);
  const tag = normalizeTags([sp.tag])[0];
  const isCommittee = COMMITTEE_ROLES.includes(role);
  const isManager = role === "ADMIN" || role === "TREASURER";

  const [rows, counts, tagCounts, used] = await Promise.all([
    listDocuments(societyId!, role, { category, tag, q }),
    getCategoryCounts(societyId!, role),
    getTagCounts(societyId!, role),
    isCommittee ? getStorageUsed(societyId!) : Promise.resolve(0),
  ]);
  const total = Object.values(counts).reduce((n, c) => n + (c ?? 0), 0);
  const docs = rows.map((d) => ({
    id: d.id, title: d.title, category: d.category, visibility: d.visibility, tags: d.tags, fileName: d.fileName,
    mimeType: d.mimeType, sizeBytes: d.sizeBytes, expiresOn: d.expiresOn, retainUntil: d.retainUntil,
    createdAt: d.createdAt, uploadedByName: d.uploadedBy.name,
    canDelete: isManager || d.uploadedById === userId,
    canTag: isCommittee,
  }));
  const href = (p: { cat?: string; tag?: string; q?: string }) => {
    const u = new URLSearchParams();
    if (p.cat) u.set("cat", p.cat);
    if (p.tag) u.set("tag", p.tag);
    if (p.q) u.set("q", p.q);
    const qs = u.toString();
    return `/dashboard/documents${qs ? `?${qs}` : ""}`;
  };
  const filtered = Boolean(category || tag || q);
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
          <DocumentUploadForm defaultCategory={category} tagSuggestions={tagCounts.map((t) => t.tag)} />
        </ToolSection>
      )}

      <form action="/dashboard/documents" className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search title, file name or tag"
          maxLength={60}
          className="h-10 w-full rounded-lg border border-input bg-white pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {category && <input type="hidden" name="cat" value={category} />}
        {tag && <input type="hidden" name="tag" value={tag} />}
      </form>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Link href={href({ tag, q })} className={chip(!category)}>All ({total})</Link>
        {CATEGORIES.filter((c) => (counts[c] ?? 0) > 0 || c === category).map((c) => (
          <Link key={c} href={href({ cat: c, tag, q })} className={chip(c === category)}>
            {CATEGORY_LABELS[c]} ({counts[c] ?? 0})
          </Link>
        ))}
      </div>

      {tagCounts.length > 0 && (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {tagCounts.slice(0, 20).map((t) => (
            <Link
              key={t.tag}
              href={href({ cat: category, tag: t.tag === tag ? undefined : t.tag, q })}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${t.tag === tag ? "bg-primary text-primary-foreground ring-primary" : "bg-primary/10 text-primary ring-transparent hover:bg-primary/20"}`}
            >
              #{t.tag} <span className="opacity-70">{t.count}</span>
            </Link>
          ))}
        </div>
      )}

      {filtered && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          {docs.length} result{docs.length !== 1 ? "s" : ""}
          {q && <> for &ldquo;{q}&rdquo;</>}
          {tag && <> tagged #{tag}</>}
          <Link href="/dashboard/documents" className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline">
            <X className="size-3" /> Clear
          </Link>
        </p>
      )}

      <DocumentsList docs={docs} now={new Date()} suggestions={tagCounts.map((t) => t.tag)} />

      {isCommittee && (
        <p className="text-center text-xs text-muted-foreground">
          Storage used: {formatBytes(used)} of {formatBytes(quotaBytes())}
        </p>
      )}
    </div>
  );
}
