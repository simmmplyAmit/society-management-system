"use client";

import { useTransition } from "react";
import { deleteDocument } from "@/actions/documents";
import { Button } from "@/components/ui/button";
import { FileText, Image as ImageIcon, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils/month";
import { CATEGORY_LABELS, expiryState, formatBytes } from "@/lib/utils/documents";
import type { DocumentCategory } from "@prisma/client";

export interface DocRow {
  id: string;
  title: string;
  category: DocumentCategory;
  visibility: "COMMITTEE" | "RESIDENTS";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  expiresOn: Date | null;
  retainUntil: Date | null;
  createdAt: Date;
  uploadedByName: string;
  canDelete: boolean;
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

export function DocumentsList({ docs, now }: { docs: DocRow[]; now: Date }) {
  if (docs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        No documents here yet.
      </div>
    );
  }
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      {docs.map((d) => {
        const Icon = d.mimeType === "application/pdf" ? FileText : ImageIcon;
        const exp = expiryState(d.expiresOn, now);
        return (
          <div key={d.id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
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
              </div>
            </div>
            {d.canDelete && <DeleteButton id={d.id} title={d.title} />}
          </div>
        );
      })}
    </div>
  );
}
