"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { approveClaim, rejectClaim } from "@/actions/claims";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { flatLabel } from "@/lib/utils/flat";
import { formatCurrency, formatDate, MONTHS } from "@/lib/utils/month";

interface Claim {
  id: string;
  utrNumber: string;
  amount: string | number;
  paidOn: Date;
  createdAt: Date;
  user: { name: string; phone: string | null };
  payments: {
    id: string;
    month: number;
    year: number;
    amount: string | number;
    flat: { number: string; floor: { number: number; wing: { name: string } } };
  }[];
}

export function ClaimsList({ claims, hasWings }: { claims: Claim[]; hasWings: boolean }) {
  if (claims.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center">
        <p className="text-sm font-medium">Nothing to verify</p>
        <p className="mt-1 text-xs text-muted-foreground">
          When a resident reports a UPI payment it shows up here.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {claims.map((c) => (
        <ClaimCard key={c.id} claim={c} hasWings={hasWings} />
      ))}
    </div>
  );
}

function ClaimCard({ claim, hasWings }: { claim: Claim; hasWings: boolean }) {
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);

  function approve() {
    startTransition(async () => {
      const r = await approveClaim(claim.id);
      if ("error" in r && r.error) return void toast.error(r.error);
      toast.success("Marked as paid");
    });
  }

  function reject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("claimId", claim.id);
    startTransition(async () => {
      const r = await rejectClaim(fd);
      if ("error" in r && r.error) return void toast.error(r.error);
      toast.success("Report rejected");
    });
  }

  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{claim.user.name}</p>
          <p className="text-xs text-muted-foreground">
            {claim.user.phone ?? "No phone"} · reported {formatDate(claim.createdAt)}
          </p>
        </div>
        <p className="shrink-0 text-lg font-semibold">{formatCurrency(claim.amount)}</p>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-muted/60 p-3 text-xs">
        <div>
          <dt className="text-muted-foreground">UTR / reference</dt>
          <dd className="mt-0.5 break-all font-mono font-semibold">{claim.utrNumber}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Paid on</dt>
          <dd className="mt-0.5 font-semibold">{formatDate(claim.paidOn)}</dd>
        </div>
      </dl>

      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
        {claim.payments.map((p) => (
          <li key={p.id} className="flex justify-between gap-2">
            <span className="truncate">
              {MONTHS[p.month - 1].slice(0, 3)} {p.year} · {flatLabel(p.flat, hasWings)}
            </span>
            <span className="shrink-0">{formatCurrency(p.amount)}</span>
          </li>
        ))}
      </ul>

      {rejecting ? (
        <form onSubmit={reject} className="mt-3 space-y-2">
          <Input name="reason" placeholder="Reason (optional), e.g. not in bank statement" maxLength={200} />
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
        <div className="mt-3 flex gap-2">
          <Button type="button" className="h-9 min-w-0 flex-1" disabled={pending} onClick={approve}>
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
