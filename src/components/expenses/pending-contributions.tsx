"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { approveContribution, cancelContribution, rejectContribution } from "@/actions/expense-contributions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils/month";

export interface PendingContribution {
  id: string;
  expenseTitle: string;
  expenseAmount: number;
  expenseDate: Date;
  receiptUrl: string | null;
  memberName: string;
  amount: number;
  requestedById: string;
  requestedByName: string;
}

export function PendingContributions({ items, currentUserId }: { items: PendingContribution[]; currentUserId: string }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Member credit awaiting approval</h3>
      {items.map((c) => (
        <Item key={c.id} item={c} mine={c.requestedById === currentUserId} />
      ))}
    </div>
  );
}

function Item({ item: c, mine }: { item: PendingContribution; mine: boolean }) {
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
    fd.set("contributionId", c.id);
    run(() => rejectContribution(fd), "Rejected");
  }

  return (
    <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-600/20">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-amber-900">{c.expenseTitle}</p>
          <p className="text-xs text-amber-900/80">
            {formatCurrency(c.expenseAmount)} · {formatDate(c.expenseDate)} · recorded by {c.requestedByName}
          </p>
        </div>
        <p className="shrink-0 text-lg font-semibold text-amber-900">{formatCurrency(c.amount)}</p>
      </div>
      <p className="mt-2 text-xs text-amber-900/80">
        Credit <span className="font-semibold">{c.memberName}</span> {formatCurrency(c.amount)} for paying this themselves.
        {c.receiptUrl && (
          <>
            {" "}
            <a href={c.receiptUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline">View receipt</a>
          </>
        )}
      </p>

      {mine ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-amber-900/80">You recorded this, so another admin or the treasurer has to approve it.</p>
          <Button type="button" variant="outline" size="sm" className="h-9" disabled={pending} onClick={() => run(() => cancelContribution(c.id), "Withdrawn")}>
            Withdraw
          </Button>
        </div>
      ) : rejecting ? (
        <form onSubmit={reject} className="mt-3 space-y-2">
          <Input name="reason" placeholder="Reason (optional)" maxLength={200} />
          <div className="flex gap-2">
            <Button type="submit" variant="destructive" size="sm" className="h-9" disabled={pending}>
              {pending ? "Rejecting…" : "Confirm reject"}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => setRejecting(false)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button type="button" className="h-9 min-w-0 flex-1" disabled={pending} onClick={() => run(() => approveContribution(c.id), "Credit added")}>
            <Check className="mr-1 size-4" />
            {pending ? "Saving…" : "Approve"}
          </Button>
          <Button type="button" variant="outline" className="h-9 min-w-0 flex-1" disabled={pending} onClick={() => setRejecting(true)}>
            <X className="mr-1 size-4" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
