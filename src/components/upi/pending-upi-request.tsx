"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { toast } from "sonner";
import { approveUpiChange, cancelUpiChange, rejectUpiChange } from "@/actions/upi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils/month";

interface Props {
  id: string;
  oldUpiId: string | null;
  newUpiId: string;
  requestedByName: string;
  createdAt: Date;
  expiresAt: Date;
  isRequester: boolean;
  canReview: boolean;
}

export function PendingUpiRequest(p: Props) {
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);

  function run(action: () => Promise<{ error?: string } | { success: true }>, ok: string) {
    startTransition(async () => {
      const r = await action();
      if ("error" in r && r.error) return void toast.error(r.error);
      toast.success(ok);
    });
  }

  function reject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("requestId", p.id);
    run(() => rejectUpiChange(fd), "Change rejected");
  }

  return (
    <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-600/20">
      <p className="text-sm font-semibold text-amber-900">UPI ID change awaiting approval</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-md bg-white px-2 py-1 font-mono text-xs ring-1 ring-border">{p.oldUpiId ?? "none"}</span>
        <ArrowRight className="size-4 text-amber-700" />
        <span className="rounded-md bg-white px-2 py-1 font-mono text-xs font-semibold ring-1 ring-border">{p.newUpiId}</span>
      </div>
      <p className="mt-2 text-xs text-amber-900/80">
        Requested by {p.requestedByName} on {formatDate(p.createdAt)}. Lapses on {formatDate(p.expiresAt)}.
      </p>

      {p.isRequester ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-amber-900/80">A different admin or the treasurer has to approve this.</p>
          <Button
            type="button" variant="outline" size="sm" className="h-9"
            disabled={pending}
            onClick={() => run(() => cancelUpiChange(p.id), "Request withdrawn")}
          >
            Withdraw request
          </Button>
        </div>
      ) : p.canReview ? (
        rejecting ? (
          <form onSubmit={reject} className="mt-3 space-y-2">
            <Input name="reason" placeholder="Reason (optional)" maxLength={200} />
            <div className="flex gap-2">
              <Button type="submit" variant="destructive" size="sm" className="h-9" disabled={pending}>
                {pending ? "Rejecting…" : "Confirm reject"}
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-amber-900/80">
              Approve only if you know this change is genuine. Confirm the new UPI ID with {p.requestedByName} in person or by phone.
            </p>
            <div className="flex gap-2">
              <Button
                type="button" className="h-9 min-w-0 flex-1" disabled={pending}
                onClick={() => run(() => approveUpiChange(p.id), "UPI ID updated")}
              >
                <Check className="mr-1 size-4" />
                {pending ? "Saving…" : "Approve"}
              </Button>
              <Button
                type="button" variant="outline" className="h-9 min-w-0 flex-1" disabled={pending}
                onClick={() => setRejecting(true)}
              >
                <X className="mr-1 size-4" />
                Reject
              </Button>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
