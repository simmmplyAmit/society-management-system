"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteDocument, updateDocumentTags } from "@/actions/documents";
import { TagInput } from "@/components/documents/tag-input";
import { Button } from "@/components/ui/button";
import { FileText, Image as ImageIcon, Tag, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils/month";
import { CATEGORY_LABELS, expiryState, formatBytes } from "@/lib/utils/documents";
import type { DocumentCategory } from "@prisma/client";

export interface DocRow {
  id: string;
  title: string;
  category: DocumentCategory;
  visibility: "COMMITTEE" | "RESIDENTS";
  tags: string[];
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  expiresOn: Date | null;
  retainUntil: Date | null;
  createdAt: Date;
  uploadedByName: string;
  canDelete: boolean;
  canTag: boolean;
}

function DeleteButton({ id, title }: { id: string; title: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
      disabled={pending}
      aria-label={`Delete ${title}`}
      onClick={() => {
        if (!window.confirm(`Delete "${title}"? It is kept for 30 days in case of a mistake, then removed.`)) return;
        startTransition(async () => {
          const r = await deleteDocument(id);
          if (r?.error) toast.error(r.error);
          else toast.success("Document deleted");
        });
      }}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

function TagEditor({ doc, suggestions, onDone }: { doc: DocRow; suggestions: string[]; onDone: () => void }) {
  const [tags, setTags] = useState(doc.tags);
  const [pending, startTransition] = useTransition();
  return (
    <div className="mt-2 space-y-2">
      <TagInput id={`tags-${doc.id}`} value={tags} onChange={setTags} suggestions={suggestions} />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          className="h-8"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const fd = new FormData();
              fd.set("tags", JSON.stringify(tags));
              const r = await updateDocumentTags(doc.id, fd);
              if ("error" in r && r.error) return void toast.error(r.error);
              toast.success("Tags saved");
              onDone();
            })
          }
        >
          {pending ? "Saving…" : "Save tags"}
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

const hrefForTag = (t: string) => `/dashboard/documents?tag=${encodeURIComponent(t)}`;

function DocRowView({ d, now, suggestions }: { d: DocRow; now: Date; suggestions: string[] }) {
  const [editing, setEditing] = useState(false);
  const Icon = d.mimeType === "application/pdf" ? FileText : ImageIcon;
  const exp = expiryState(d.expiresOn, now);
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <a href={`/api/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium hover:underline">
          {d.title}
        </a>
        <p className="truncate text-xs text-muted-foreground">
          {CATEGORY_LABELS[d.category]} · {formatDate(d.createdAt)} · {formatBytes(d.sizeBytes)} · {d.uploadedByName}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {d.visibility === "RESIDENTS" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-inset ring-sky-600/20">
              <Users className="size-3" /> Residents
            </span>
          )}
          {d.expiresOn && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                exp === "expired" ? "bg-red-50 text-red-700 ring-red-600/20" : exp === "soon" ? "bg-amber-50 text-amber-700 ring-amber-600/20" : "bg-muted text-muted-foreground ring-border"
              }`}
            >
              {exp === "expired" ? "Expired" : "Renews"} {formatDate(d.expiresOn)}
            </span>
          )}
          {d.retainUntil && d.retainUntil.getTime() > now.getTime() && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
              Kept until {formatDate(d.retainUntil)}
            </span>
          )}
          {d.tags.map((t) => (
            <Link key={t} href={hrefForTag(t)} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/20">
              #{t}
            </Link>
          ))}
        </div>
        {editing && <TagEditor doc={d} suggestions={suggestions} onDone={() => setEditing(false)} />}
      </div>
      {d.canTag && !editing && (
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label={`Edit tags of ${d.title}`} onClick={() => setEditing(true)}>
          <Tag className="h-3.5 w-3.5" />
        </Button>
      )}
      {d.canDelete && <DeleteButton id={d.id} title={d.title} />}
    </div>
  );
}

export function DocumentsList({
  docs,
  now,
  suggestions = [],
}: {
  docs: DocRow[];
  now: Date;
  suggestions?: string[];
}) {
  if (docs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        No documents here yet.
      </div>
    );
  }
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      {docs.map((d) => (
        <DocRowView key={d.id} d={d} now={now} suggestions={suggestions} />
      ))}
    </div>
  );
}
