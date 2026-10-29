"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { anonymiseUser, resolveDataRequest } from "@/actions/privacy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { timeAgo } from "@/lib/utils/community";

export interface OpenRequest {
  id: string;
  type: "CORRECTION" | "ERASURE";
  note: string | null;
  createdAt: Date;
  userId: string;
  userName: string;
  isMine: boolean;
}

function RequestRow({ r, now }: { r: OpenRequest; now: Date }) {
  const [pending, startTransition] = useTransition();
  const [declining, setDeclining] = useState(false);

  function run(fn: () => Promise<{ error?: string } | { success: true }>, ok: string) {
    startTransition(async () => {
      const res = await fn();
      if ("error" in res && res.error) toast.error(res.error);
      else toast.success(ok);
    });
  }

  return (
    <div className="space-y-2 px-4 py-3">
      <div>
        <p className="text-sm font-medium">
          {r.type === "ERASURE" ? "🗑️ Erase data" : "✏️ Correct data"} · {r.userName}
        </p>
        <p className="text-xs text-muted-foreground">{timeAgo(r.createdAt, now)}{r.isMine ? " · your own request" : ""}</p>
        {r.note && <p className="mt-1 whitespace-pre-line text-sm">{r.note}</p>}
      </div>
      {r.isMine ? (
        <p className="text-xs text-amber-700">Another admin must handle this one.</p>
      ) : declining ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const reason = String(new FormData(e.currentTarget).get("reason") ?? "");
            run(() => resolveDataRequest(r.id, "REJECTED", reason), "Request declined");
          }}
        >
          <Input name="reason" required maxLength={500} placeholder="Why is it being declined?" className="h-9" />
          <Button type="submit" size="sm" className="h-9" disabled={pending}>Decline</Button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {r.type === "ERASURE" && (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => {
                if (!window.confirm(`Erase ${r.userName}'s account? Their name, email, phone and posts are removed. Financial records stay without their name. This can't be undone.`)) return;
                run(() => anonymiseUser(r.userId), "Account erased");
              }}
            >
              Erase account
            </Button>
          )}
          {r.type === "CORRECTION" && (
            <Button size="sm" disabled={pending} onClick={() => run(() => resolveDataRequest(r.id, "DONE", "Corrected"), "Marked done")}>
              Mark corrected
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setDeclining(true)}>Decline…</Button>
        </div>
      )}
    </div>
  );
}

export function DataRequestsAdmin({ requests, now }: { requests: OpenRequest[]; now: Date }) {
  if (requests.length === 0) return <p className="text-sm text-muted-foreground">No open requests. 🎉</p>;
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border">
      {requests.map((r) => (
        <RequestRow key={r.id} r={r} now={now} />
      ))}
    </div>
  );
}
