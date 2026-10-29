"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { createPost } from "@/actions/community";
import { useErrorText } from "@/components/i18n/use-error-text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { POST_BODY_MAX, POST_CATEGORIES } from "@/lib/utils/community";

export function PostComposer() {
  const t = useTranslations("community");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const r = await createPost(fd);
      if ("error" in r && r.error) return void toast.error(errorText(r.error));
      toast.success(t("posted"));
      form.reset();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <Textarea name="body" required minLength={2} maxLength={POST_BODY_MAX} rows={3} placeholder={t("composerPlaceholder")} aria-label={t("post")} />
      <div className="flex items-center gap-2">
        <select name="category" defaultValue="GENERAL" aria-label={t("postType")} className="h-9 flex-1 rounded-lg border border-input bg-white px-2 text-sm">
          {POST_CATEGORIES.map((c) => (
            <option key={c} value={c}>{t(`category.${c}`)}</option>
          ))}
        </select>
        <Button type="submit" className="h-9" disabled={pending}>{pending ? t("posting") : t("post")}</Button>
      </div>
      <p className="text-[11px] text-muted-foreground">{t("composerHint")}</p>
    </form>
  );
}
