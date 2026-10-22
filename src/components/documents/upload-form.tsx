"use client";

import { useRef, useState, useTransition } from "react";
import { requestDocumentUpload, confirmDocumentUpload } from "@/actions/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ALLOWED_TYPES,
  CATEGORIES,
  CATEGORY_LABELS,
  EXPIRING_CATEGORIES,
  MAX_DOCUMENT_BYTES,
  defaultVisibility,
} from "@/lib/utils/documents";
import { TagInput } from "@/components/documents/tag-input";
import type { DocumentCategory } from "@prisma/client";

const field =
  "h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function DocumentUploadForm({ defaultCategory, tagSuggestions = [] }: { defaultCategory?: DocumentCategory; tagSuggestions?: string[] }) {
  const [busy, startTransition] = useTransition();
  const [category, setCategory] = useState<DocumentCategory>(defaultCategory ?? "BILL");
  const [visibility, setVisibility] = useState(defaultVisibility(category));
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState("");

  function onCategory(c: DocumentCategory) {
    setCategory(c);
    setVisibility(defaultVisibility(c));
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, "").slice(0, 120));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const file = fileRef.current?.files?.[0];
    if (!file) return void toast.error("Choose a file");
    if (!ALLOWED_TYPES[file.type]) return void toast.error("Only PDF, JPG, PNG or WebP files can be uploaded");
    if (file.size > MAX_DOCUMENT_BYTES) return void toast.error("Files can be at most 10 MB");

    const fd = new FormData(form);
    fd.delete("file");
    fd.set("fileName", file.name);
    fd.set("mimeType", file.type);
    fd.set("sizeBytes", String(file.size));
    fd.set("tags", JSON.stringify(tags));

    startTransition(async () => {
      try {
        setStep("Preparing…");
        const r = await requestDocumentUpload(fd);
        if (!("success" in r) || !r.success) return void toast.error((r as { error: string }).error);

        setStep("Uploading…");
        const put = await fetch(r.uploadUrl, { method: "PUT", headers: { "Content-Type": r.contentType }, body: file });
        if (!put.ok) return void toast.error("The upload failed. Please try again");

        setStep("Checking…");
        const c = await confirmDocumentUpload(r.documentId);
        if ("error" in c && c.error) return void toast.error(c.error);

        toast.success("Document uploaded");
        form.reset();
        setTitle("");
        setTags([]);
        setCategory(defaultCategory ?? "BILL");
        setVisibility(defaultVisibility(defaultCategory ?? "BILL"));
      } catch {
        toast.error("The upload failed. Check your connection and try again");
      } finally {
        setStep("");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="doc-file">File * (PDF or photo, up to 10 MB)</Label>
        <input
          ref={fileRef}
          id="doc-file"
          name="file"
          type="file"
          required
          accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={onFile}
          className="block w-full rounded-lg border border-input bg-white text-sm file:mr-3 file:h-10 file:border-0 file:bg-primary/10 file:px-3 file:text-sm file:font-medium file:text-primary"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="doc-title">Title *</Label>
        <Input id="doc-title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lift AMC agreement 2026" required minLength={2} maxLength={120} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Type *</Label>
          <select name="category" value={category} onChange={(e) => onCategory(e.target.value as DocumentCategory)} className={field}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Who can see it</Label>
          <select name="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)} className={field}>
            <option value="COMMITTEE">Committee only</option>
            <option value="RESIDENTS">All residents</option>
          </select>
        </div>
      </div>
      {EXPIRING_CATEGORIES.includes(category) && (
        <div className="space-y-1.5">
          <Label htmlFor="doc-exp">Expires / renews on (optional)</Label>
          <Input id="doc-exp" name="expiresOn" type="date" />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="doc-tags">Tags (for search)</Label>
        <TagInput id="doc-tags" value={tags} onChange={setTags} suggestions={tagSuggestions} />
      </div>
      {visibility === "RESIDENTS" && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-600/20">
          Every owner and tenant in the society will be able to open this file.
        </p>
      )}
      <Button type="submit" className="h-10 w-full" disabled={busy}>
        {busy ? step || "Uploading…" : "Upload"}
      </Button>
    </form>
  );
}
