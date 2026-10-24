"use client";

import { useRef, useState, useTransition } from "react";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { deleteDocument } from "@/actions/documents";
import { fileProblem, uploadAttachments, type AttachTarget } from "@/lib/client/upload-documents";

export interface AttachmentRow {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
}

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

/** File picker used inside the Add expense / Add income forms. Files upload after the entry is saved. */
export function AttachmentsField({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      <label htmlFor="attach-files" className="text-sm font-medium">Attach bills or receipts (optional)</label>
      <input
        ref={ref}
        id="attach-files"
        type="file"
        multiple
        accept={ACCEPT}
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          const bad = picked.map(fileProblem).find(Boolean);
          if (bad) toast.error(bad);
          onChange([...files, ...picked.filter((f) => !fileProblem(f))].slice(0, 5));
          if (ref.current) ref.current.value = "";
        }}
        className="block w-full rounded-lg border border-input bg-white text-sm file:mr-3 file:h-10 file:border-0 file:bg-primary/10 file:px-3 file:text-sm file:font-medium file:text-primary"
      />
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-xs">
              <span className="truncate">{f.name}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))}>
                <X className="size-3.5 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">PDF or photos, up to 5 files of 10 MB. Visible to the committee only.</p>
    </div>
  );
}

/** Files already attached to an entry, with add and remove for admins and the treasurer. */
export function Attachments({
  target,
  docs,
  canEdit,
  category,
  titlePrefix,
}: {
  target: AttachTarget;
  docs: AttachmentRow[];
  canEdit: boolean;
  category: "BILL" | "OTHER";
  titlePrefix: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, startTransition] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (ref.current) ref.current.value = "";
    const bad = picked.map(fileProblem).find(Boolean);
    if (bad) return void toast.error(bad);
    if (picked.length === 0) return;
    startTransition(async () => {
      const r = await uploadAttachments(picked, target, { category, titlePrefix });
      if (r.uploaded) toast.success(`${r.uploaded} file${r.uploaded !== 1 ? "s" : ""} attached`);
      r.errors.forEach((m) => toast.error(m));
    });
  }

  if (docs.length === 0 && !canEdit) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {docs.map((d) => (
        <span key={d.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ring-border">
          <Paperclip className="size-3 shrink-0 text-muted-foreground" />
          <a href={`/api/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="truncate hover:underline" title={d.fileName}>
            {d.fileName}
          </a>
          {canEdit && (
            <button
              type="button"
              disabled={removing === d.id}
              aria-label={`Remove ${d.fileName}`}
              onClick={() => {
                if (!window.confirm(`Remove "${d.fileName}"? It is kept for 30 days, then deleted.`)) return;
                setRemoving(d.id);
                startTransition(async () => {
                  const r = await deleteDocument(d.id);
                  if (r?.error) toast.error(r.error);
                  setRemoving(null);
                });
              }}
            >
              <X className="size-3 text-muted-foreground hover:text-destructive" />
            </button>
          )}
        </span>
      ))}
      {canEdit && (
        <>
          <input ref={ref} type="file" multiple accept={ACCEPT} onChange={onPick} className="hidden" />
          <button
            type="button"
            disabled={busy}
            onClick={() => ref.current?.click()}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-primary ring-1 ring-inset ring-primary/30 hover:bg-primary/10"
          >
            <Paperclip className="size-3" /> {busy ? "Uploading…" : docs.length ? "Add" : "Attach file"}
          </button>
        </>
      )}
    </div>
  );
}
