"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addComplaintUpdate, assignComplaint, changeComplaintStatus } from "@/actions/complaints";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { STATUS_LABELS, UPDATE_BODY_MAX, timeAgo } from "@/lib/utils/community";
import type { ComplaintStatus } from "@prisma/client";

export interface ThreadItem {
  id: string;
  kind: "COMMENT" | "STATUS" | "ASSIGNED";
  body: string;
  internal: boolean;
  toStatus: ComplaintStatus | null;
  createdAt: Date;
  authorName: string;
  authorIsCommittee: boolean;
}

export function ComplaintThread({
  complaintId,
  status,
  items,
  now,
  isCommittee,
  isRaiser,
  canReopen,
  assignees,
  assignedToId,
}: {
  complaintId: string;
  status: ComplaintStatus;
  items: ThreadItem[];
  now: Date;
  isCommittee: boolean;
  isRaiser: boolean;
  canReopen: boolean;
  assignees: { id: string; name: string }[];
  assignedToId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [resolving, setResolving] = useState(false);

  function run(fn: () => Promise<{ error?: string } | { success: true }>, ok?: string) {
    startTransition(async () => {
      const r = await fn();
      if ("error" in r && r.error) return void toast.error(r.error);
      if (ok) toast.success(ok);
      router.refresh();
    });
  }

  function reply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const r = await addComplaintUpdate(complaintId, fd);
      if ("error" in r && r.error) return void toast.error(r.error);
      form.reset();
      router.refresh();
    });
  }

  function resolve(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const note = String(new FormData(e.currentTarget).get("note") ?? "");
    run(() => changeComplaintStatus(complaintId, "RESOLVED", note), "Marked resolved");
    setResolving(false);
  }

  return (
    <div className="space-y-4">
      {isCommittee && status !== "CLOSED" && (
        <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-border">
          <p className="text-sm font-semibold">Handle this complaint</p>
          <div className="flex flex-wrap gap-2">
            {status === "OPEN" && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => changeComplaintStatus(complaintId, "IN_PROGRESS"), "Marked in progress")}>Start work</Button>}
            {status === "RESOLVED" && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => changeComplaintStatus(complaintId, "IN_PROGRESS"), "Back in progress")}>More work needed</Button>}
            {(status === "OPEN" || status === "IN_PROGRESS") && <Button size="sm" disabled={pending} onClick={() => setResolving((r) => !r)}>Mark resolved</Button>}
          </div>
          {resolving && (
            <form onSubmit={resolve} className="space-y-2">
              <Textarea name="note" required maxLength={UPDATE_BODY_MAX} rows={3} placeholder="What was done? The resident will see this." />
              <Button type="submit" size="sm" disabled={pending}>Confirm resolved</Button>
            </form>
          )}
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="assignee" className="text-muted-foreground">Assigned to</label>
            <select
              id="assignee"
              defaultValue={assignedToId ?? ""}
              disabled={pending}
              onChange={(e) => run(() => assignComplaint(complaintId, e.target.value), "Assignment updated")}
              className="h-9 flex-1 rounded-lg border border-input bg-white px-2 text-sm"
            >
              <option value="">Nobody yet</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {isRaiser && status === "RESOLVED" && (
        <div className="space-y-2 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-600/20">
          <p className="text-sm font-semibold text-emerald-800">The committee says this is fixed. Is it?</p>
          <div className="flex gap-2">
            <Button size="sm" disabled={pending} onClick={() => run(() => changeComplaintStatus(complaintId, "CLOSED"), "Thanks, closed")}>Yes, close it</Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => changeComplaintStatus(complaintId, "OPEN", "Still not fixed"), "Reopened")}>No, reopen</Button>
          </div>
        </div>
      )}
      {isRaiser && status === "CLOSED" && canReopen && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => changeComplaintStatus(complaintId, "OPEN", "Problem came back"), "Reopened")}>Problem came back? Reopen</Button>
      )}

      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
        {items.map((u) => (
          <div
            key={u.id}
            className={`rounded-lg px-3 py-2 text-sm ring-1 ${
              u.kind !== "COMMENT" ? "bg-muted/50 text-muted-foreground ring-transparent" : u.internal ? "bg-amber-50 ring-amber-600/20" : u.authorIsCommittee ? "bg-primary/5 ring-primary/15" : "bg-card ring-border"
            }`}
          >
            <p className="text-xs font-semibold">
              {u.authorName}
              {u.authorIsCommittee && <span className="ml-1 font-normal text-primary">· Committee</span>}
              <span className="font-normal text-muted-foreground"> · {timeAgo(u.createdAt, now)}</span>
              {u.internal && <span className="ml-1 inline-flex items-center gap-0.5 font-medium text-amber-700"><Lock className="size-3" /> Committee only</span>}
            </p>
            <p className="whitespace-pre-line">
              {u.kind === "STATUS" && u.toStatus ? <b>{STATUS_LABELS[u.toStatus]}. </b> : null}
              {u.body}
            </p>
          </div>
        ))}
      </div>

      {status !== "CLOSED" && (
        <form onSubmit={reply} className="space-y-2">
          <Textarea name="body" required maxLength={UPDATE_BODY_MAX} rows={3} placeholder={isCommittee ? "Reply to the resident" : "Add a message for the committee"} aria-label="Message" />
          <div className="flex items-center gap-3">
            {isCommittee && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" name="internal" className="size-4 rounded border-input" /> Committee-only note
              </label>
            )}
            <Button type="submit" size="sm" className="ml-auto" disabled={pending}>Send</Button>
          </div>
        </form>
      )}
    </div>
  );
}
