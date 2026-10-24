"use client";

import { useState, useTransition } from "react";
import { addComment, deleteComment, deletePost } from "@/actions/community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EyeOff, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { COMMENT_BODY_MAX, POST_LABELS, timeAgo } from "@/lib/utils/community";
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
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(post.comments.length > 0 && post.comments.length <= 3);
  const mine = post.author.id === userId;

  function remove() {
    const reason = mine ? undefined : window.prompt("Why is this being removed? (optional, shown to the committee)") ?? undefined;
    if (!mine && reason === undefined) return;
    if (mine && !window.confirm("Delete your post?")) return;
    startTransition(async () => {
      const r = await deletePost(post.id, reason);
      if (r?.error) toast.error(r.error);
      else toast.success(mine ? "Post deleted" : "Post hidden");
    });
  }

  function comment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("postId", post.id);
    startTransition(async () => {
      const r = await addComment(fd);
      if ("error" in r && r.error) return void toast.error(r.error);
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
            {post.author.isCommittee && <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Committee</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            {timeAgo(post.createdAt, now)} · <span className="font-medium">{POST_LABELS[post.category]}</span>
          </p>
        </div>
        {(mine || (isCommittee && !post.hidden)) && (
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" aria-label={mine ? "Delete post" : "Hide post"} disabled={pending} onClick={remove}>
            {mine ? <Trash2 className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>
      {post.hidden && (
        <p className="mt-2 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          Hidden from residents{post.hiddenReason ? `: ${post.hiddenReason}` : ""}
        </p>
      )}
      <p className="mt-3 whitespace-pre-line text-sm">{post.body}</p>

      {!post.hidden && (
        <div className="mt-3 border-t border-border pt-2">
          <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
            <MessageCircle className="size-3.5" /> {post.comments.length} comment{post.comments.length !== 1 ? "s" : ""}
          </button>
          {open && (
            <div className="mt-2 space-y-2">
              {post.comments.map((c) => (
                <div key={c.id} className={`flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm ${c.hidden ? "opacity-60" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">
                      {c.author.name} <span className="font-normal text-muted-foreground">· {timeAgo(c.createdAt, now)}{c.hidden ? " · hidden" : ""}</span>
                    </p>
                    <p className="whitespace-pre-line">{c.body}</p>
                  </div>
                  {(c.author.id === userId || (isCommittee && !c.hidden)) && (
                    <button
                      type="button"
                      aria-label="Delete comment"
                      disabled={pending}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        startTransition(async () => {
                          const r = await deleteComment(c.id);
                          if (r?.error) toast.error(r.error);
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <form onSubmit={comment} className="flex gap-2">
                <Input name="body" required maxLength={COMMENT_BODY_MAX} placeholder="Write a comment" aria-label="Comment" className="h-9" />
                <Button type="submit" size="sm" className="h-9" disabled={pending}>Send</Button>
              </form>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
