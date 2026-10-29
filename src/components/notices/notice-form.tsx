"use client";

import { useTransition } from "react";
import { createNotice, updateNotice } from "@/actions/notices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { NOTICE_BODY_MAX, NOTICE_CATEGORIES, NOTICE_LABELS, NOTICE_TITLE_MAX } from "@/lib/utils/community";
import type { NoticeCategory } from "@prisma/client";
import { NOTICE_EMOJI } from "@/lib/utils/emoji";

const field =
  "h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export interface NoticeInitial {
  id: string;
  title: string;
  body: string;
  category: NoticeCategory;
  pinned: boolean;
  expiresOn: Date | null;
}

const dateValue = (d: Date | null) => {
  if (!d) return "";
  const x = new Date(d);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`;
};

export function NoticeForm({ initial, onDone }: { initial?: NoticeInitial; onDone?: () => void }) {
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().split("T")[0];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const r = initial ? await updateNotice(initial.id, fd) : await createNotice(fd);
      if ("error" in r && r.error) return void toast.error(r.error);
      if (initial) {
        toast.success("Notice updated");
        return void onDone?.();
      }
      const emailed = (r as { emailed?: { sent: number; failed: number; capped: boolean } | null }).emailed;
      toast.success(
        emailed
          ? `Notice posted. Emailed ${emailed.sent} resident${emailed.sent !== 1 ? "s" : ""}` +
              (emailed.failed ? `, ${emailed.failed} failed` : "") +
              (emailed.capped ? " (first 200 only)" : "")
          : "Notice posted"
      );
      form.reset();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`n-title-${initial?.id ?? "new"}`}>Title *</Label>
        <Input id={`n-title-${initial?.id ?? "new"}`} name="title" defaultValue={initial?.title} required minLength={3} maxLength={NOTICE_TITLE_MAX} placeholder="e.g. Water tank cleaning on Sunday" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <select name="category" defaultValue={initial?.category ?? "GENERAL"} className={field}>
            {NOTICE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{NOTICE_EMOJI[c]} {NOTICE_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`n-exp-${initial?.id ?? "new"}`}>Show until (optional)</Label>
          <Input id={`n-exp-${initial?.id ?? "new"}`} name="expiresOn" type="date" defaultValue={dateValue(initial?.expiresOn ?? null)} min={initial ? undefined : today} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`n-body-${initial?.id ?? "new"}`}>Notice *</Label>
        <Textarea id={`n-body-${initial?.id ?? "new"}`} name="body" defaultValue={initial?.body} required minLength={3} maxLength={NOTICE_BODY_MAX} rows={5} placeholder="Write the details residents need to know" />
      </div>
      <div className="space-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="pinned" defaultChecked={initial?.pinned} className="size-4 rounded border-input" /> Pin to the top
        </label>
        {!initial && (
          <label className="flex items-center gap-2">
            <input type="checkbox" name="notify" className="size-4 rounded border-input" /> Also email residents (verified email only)
          </label>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="h-10 flex-1" disabled={pending}>
          {pending ? "Saving…" : initial ? "Save changes" : "Post notice"}
        </Button>
        {initial && <Button type="button" variant="outline" className="h-10" onClick={onDone}>Cancel</Button>}
      </div>
    </form>
  );
}
