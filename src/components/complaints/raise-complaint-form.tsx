"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { raiseComplaint } from "@/actions/complaints";
import { useErrorText } from "@/components/i18n/use-error-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { fileProblemKey, uploadAttachments } from "@/lib/client/upload-documents";
import {
  COMPLAINT_BODY_MAX,
  COMPLAINT_CATEGORIES,
  COMPLAINT_TITLE_MAX,
  MAX_COMPLAINT_PHOTOS,
} from "@/lib/utils/community";

const field =
  "h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function RaiseComplaintForm({ flats }: { flats: { id: string; label: string }[] }) {
  const t = useTranslations("complaints");
  const tf = useTranslations("files");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [photos, setPhotos] = useState<File[]>([]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const r = await raiseComplaint(fd);
      if (!("success" in r) || !r.success) return void toast.error(errorText((r as { error: string }).error));
      toast.success(t("form.sent"));
      form.reset();
      // The complaint is saved; photos are a bonus, so a failed upload never undoes it
      if (photos.length > 0) {
        const up = await uploadAttachments(photos, { complaintId: r.complaintId }, { category: "OTHER", titlePrefix: "Complaint" });
        up.errors.forEach((m) => toast.error(t("form.photoFailed", { message: m })));
      }
      setPhotos([]);
      router.push(`/dashboard/complaints/${r.complaintId}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t("form.type")}</Label>
          <select name="category" required defaultValue="" className={field}>
            <option value="" disabled>{t("form.choose")}</option>
            {COMPLAINT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{t(`category.${c}`)}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>{t("form.urgency")}</Label>
          <select name="priority" defaultValue="NORMAL" className={field}>
            <option value="NORMAL">{t("priority.NORMAL")}</option>
            <option value="URGENT">{t("priority.URGENT")}</option>
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-title">{t("form.titleLabel")}</Label>
        <Input id="c-title" name="title" required minLength={3} maxLength={COMPLAINT_TITLE_MAX} placeholder={t("form.titlePlaceholder")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-desc">{t("form.description")}</Label>
        <Textarea id="c-desc" name="description" required minLength={5} maxLength={COMPLAINT_BODY_MAX} rows={4} placeholder={t("form.descriptionPlaceholder")} />
      </div>
      {flats.length > 0 && (
        <div className="space-y-1.5">
          <Label>{t("form.flat")}</Label>
          <select name="flatId" defaultValue="" className={field}>
            <option value="">{t("form.commonArea")}</option>
            {flats.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="c-photos">{t("form.photos")}</Label>
        <input
          id="c-photos"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            const bad = picked.find((f) => fileProblemKey(f));
            if (bad) toast.error(tf(fileProblemKey(bad)!, { name: bad.name }));
            setPhotos(picked.filter((f) => !fileProblemKey(f)).slice(0, MAX_COMPLAINT_PHOTOS));
          }}
          className="block w-full rounded-lg border border-input bg-white text-sm file:mr-3 file:h-10 file:border-0 file:bg-primary/10 file:px-3 file:text-sm file:font-medium file:text-primary"
        />
        <p className="text-xs text-muted-foreground">{t("form.photosHint", { max: MAX_COMPLAINT_PHOTOS })}</p>
      </div>
      <Button type="submit" className="h-10 w-full" disabled={pending}>{pending ? tc("sending") : t("form.submit")}</Button>
    </form>
  );
}
