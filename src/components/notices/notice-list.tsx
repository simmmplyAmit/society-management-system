"use client";

import { useState, useTransition } from "react";
import { deleteNotice, setNoticePinned } from "@/actions/notices";
import { NoticeForm } from "@/components/notices/notice-form";
import { Button } from "@/components/ui/button";
import { Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils/month";
import { NOTICE_LABELS } from "@/lib/utils/community";
import type { NoticeCategory } from "@prisma/client";

export interface NoticeRow {
  id: string;
  title: string;
  body: string;
  category: NoticeCategory;
  pinned: boolean;
  expiresOn: Date | null;
  createdAt: Date;
  authorName: string;
}

function NoticeCard({ n, canManage, expired }: { n: NoticeRow; canManage: boolean; expired?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const emergency = n.category === "EMERGENCY";

  if (editing) {
    return (
      <div className="rounded-xl bg-card p-4 ring-1 ring-border">
        <NoticeForm initial={n} onDone={() => setEditing(false)} />
      </div>
    );
  }
  return (
    <article className={`rounded-xl bg-card p-4 ring-1 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${emergency ? "ring-red-300" : "ring-border"} ${expired ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${emergency ? "bg-red-50 text-red-700 ring-red-600/20" : "bg-primary/10 text-primary ring-transparent"}`}>
              {NOTICE_LABELS[n.category]}
            </span>
            {n.pinned && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                <Pin className="size-3" /> Pinned
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold leading-snug">{n.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDate(n.createdAt)} · {n.authorName}
            {n.expiresOn ? ` · ${expired ? "ended" : "until"} ${formatDate(n.expiresOn)}` : ""}
          </p>
        </div>
        {canManage && (
          <div className="flex shrink-0 gap-0.5">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label={n.pinned ? "Unpin" : "Pin"} disabled={pending}
              onClick={() => startTransition(async () => { const r = await setNoticePinned(n.id, !n.pinned); if ("error" in r && r.error) toast.error(r.error); })}>
              {n.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label="Edit notice" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" aria-label="Delete notice" disabled={pending}
              onClick={() => {
                if (!window.confirm(`Delete "${n.title}"? Residents will no longer see it.`)) return;
                startTransition(async () => { const r = await deleteNotice(n.id); if (r?.error) toast.error(r.error); else toast.success("Notice deleted"); });
              }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
      <p className="mt-3 whitespace-pre-line text-sm text-foreground/90">{n.body}</p>
    </article>
  );
}

export function NoticeList({ notices, canManage, expired }: { notices: NoticeRow[]; canManage: boolean; expired?: boolean }) {
  if (notices.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        {expired ? "No past notices." : "No notices right now."}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {notices.map((n) => (
        <NoticeCard key={n.id} n={n} canManage={canManage} expired={expired} />
      ))}
    </div>
  );
}
