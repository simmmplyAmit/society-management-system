"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { addComment, deleteComment, deletePost } from "@/actions/community";
import { useErrorText } from "@/components/i18n/use-error-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EyeOff, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { COMMENT_BODY_MAX, timeAgo } from "@/lib/utils/community";
import type { PostCategory } from "@prisma/client";

export interface PostView {
  id: string;
  category: PostCategory;
  body: string;
  hidden: boolean;
  hiddenReason: string | null;
  createdAt: Date;
  author: { id: string; name: string; isCommittee: boolean };
  comments: { id: string; body: string; hidden: boolean; createdAt: Date; author: { id: string; name: string } }[];
}

export function PostCard({ post, now, userId, isCommittee }: { post: PostView; now: Date; userId: string; isCommittee: boolean }) {
  const t = useTranslations("community");
  const tc = useTranslations("common");
  const locale = useLocale();
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(post.comments.length > 0 && post.comments.length <= 3);
  const mine = post.author.id === userId;

  function remove() {
    const reason = mine ? undefined : window.prompt(t("hidePrompt")) ?? undefined;
    if (!mine && reason === undefined) return;
    if (mine && !window.confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      const r = await deletePost(post.id, reason);
      if (r?.error) toast.error(errorText(r.error));
      else toast.success(mine ? t("postDeleted") : t("postHidden"));
    });
  }

  function comment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("postId", post.id);
    startTransition(async () => {
      const r = await addComment(fd);
      if ("error" in r && r.error) return void toast.error(errorText(r.error));
      form.reset();
    });
  }

  return (
    <article className={`rounded-xl bg-card p-4 ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${post.hidden ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {post.author.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {post.author.name}
            {post.author.isCommittee && <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{tc("committee")}</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            {timeAgo(post.createdAt, now, locale)} · <span className="font-medium">{t(`category.${post.category}`)}</span>
          </p>
        </div>
        {(mine || (isCommittee && !post.hidden)) && (
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" aria-label={mine ? t("deletePost") : t("hidePost")} disabled={pending} onClick={remove}>
            {mine ? <Trash2 className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>
      {post.hidden && (
        <p className="mt-2 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          {post.hiddenReason ? t("hiddenReason", { reason: post.hiddenReason }) : t("hiddenFromResidents")}
        </p>
      )}
      <p className="mt-3 whitespace-pre-line text-sm">{post.body}</p>

      {!post.hidden && (
        <div className="mt-3 border-t border-border pt-2">
          <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
            <MessageCircle className="size-3.5" /> {t("comments", { count: post.comments.length })}
          </button>
          {open && (
            <div className="mt-2 space-y-2">
              {post.comments.map((c) => (
                <div key={c.id} className={`flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm ${c.hidden ? "opacity-60" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">
                      {c.author.name} <span className="font-normal text-muted-foreground">· {timeAgo(c.createdAt, now, locale)}{c.hidden ? ` · ${t("hidden")}` : ""}</span>
                    </p>
                    <p className="whitespace-pre-line">{c.body}</p>
                  </div>
                  {(c.author.id === userId || (isCommittee && !c.hidden)) && (
                    <button
                      type="button"
                      aria-label={t("deleteComment")}
                      disabled={pending}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        startTransition(async () => {
                          const r = await deleteComment(c.id);
                          if (r?.error) toast.error(errorText(r.error));
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <form onSubmit={comment} className="flex gap-2">
                <Input name="body" required maxLength={COMMENT_BODY_MAX} placeholder={t("writeComment")} aria-label={t("comment")} className="h-9" />
                <Button type="submit" size="sm" className="h-9" disabled={pending}>{tc("send")}</Button>
              </form>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
