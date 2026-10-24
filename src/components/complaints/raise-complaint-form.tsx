"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { raiseComplaint } from "@/actions/complaints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { fileProblem, uploadAttachments } from "@/lib/client/upload-documents";
import {
  COMPLAINT_BODY_MAX,
  COMPLAINT_CATEGORIES,
  COMPLAINT_LABELS,
  COMPLAINT_TITLE_MAX,
  MAX_COMPLAINT_PHOTOS,
} from "@/lib/utils/community";

const field =
  "h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function RaiseComplaintForm({ flats }: { flats: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [photos, setPhotos] = useState<File[]>([]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const r = await raiseComplaint(fd);
      if (!("success" in r) || !r.success) return void toast.error((r as { error: string }).error);
      toast.success("Complaint sent to the committee");
      form.reset();
      // The complaint is saved; photos are a bonus, so a failed upload never undoes it
      if (photos.length > 0) {
        const up = await uploadAttachments(photos, { complaintId: r.complaintId }, { category: "OTHER", titlePrefix: "Complaint" });
        up.errors.forEach((m) => toast.error(`${m}. You can add it again from the complaint`));
      }
      setPhotos([]);
      router.push(`/dashboard/complaints/${r.complaintId}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Type *</Label>
          <select name="category" required defaultValue="" className={field}>
            <option value="" disabled>Choose</option>
            {COMPLAINT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{COMPLAINT_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>How urgent?</Label>
          <select name="priority" defaultValue="NORMAL" className={field}>
            <option value="NORMAL">Normal</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-title">Short title *</Label>
        <Input id="c-title" name="title" required minLength={3} maxLength={COMPLAINT_TITLE_MAX} placeholder="e.g. Water leaking from the ceiling" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-desc">What is the problem? *</Label>
        <Textarea id="c-desc" name="description" required minLength={5} maxLength={COMPLAINT_BODY_MAX} rows={4} placeholder="Where it is, since when, and anything the committee should know" />
      </div>
      {flats.length > 0 && (
        <div className="space-y-1.5">
          <Label>Which flat is affected?</Label>
          <select name="flatId" defaultValue="" className={field}>
            <option value="">Common area / not a flat</option>
            {flats.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="c-photos">Photos (optional)</Label>
        <input
          id="c-photos"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            const bad = picked.map(fileProblem).find(Boolean);
            if (bad) toast.error(bad);
            setPhotos(picked.filter((f) => !fileProblem(f)).slice(0, MAX_COMPLAINT_PHOTOS));
          }}
          className="block w-full rounded-lg border border-input bg-white text-sm file:mr-3 file:h-10 file:border-0 file:bg-primary/10 file:px-3 file:text-sm file:font-medium file:text-primary"
        />
        <p className="text-xs text-muted-foreground">Up to {MAX_COMPLAINT_PHOTOS} files. Only you and the committee can see your complaint.</p>
      </div>
      <Button type="submit" className="h-10 w-full" disabled={pending}>{pending ? "Sending…" : "Send complaint"}</Button>
    </form>
  );
}
