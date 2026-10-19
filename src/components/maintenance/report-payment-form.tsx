"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { submitPaymentClaim } from "@/actions/claims";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils/month";

/** After paying by UPI, the resident reports the UTR for the selected dues. */
export function ReportPaymentForm({
  paymentIds,
  total,
}: {
  paymentIds: string[];
  total: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().split("T")[0];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    for (const id of paymentIds) fd.append("paymentId", id);
    startTransition(async () => {
      const r = await submitPaymentClaim(fd);
      if ("error" in r && r.error) return void toast.error(r.error);
      toast.success("Sent for verification");
      setOpen(false);
      router.refresh();
    });
  }

  const disabled = paymentIds.length === 0;

  return (
    <div className="rounded-xl bg-card ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="flex w-full items-center gap-3 p-4 text-left disabled:opacity-50"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">I&apos;ve paid. Enter the UPI reference</span>
          <span className="block text-xs text-muted-foreground">
            Your society confirms it and marks the dues paid
          </span>
        </span>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <form onSubmit={submit} className="space-y-3 border-t border-border p-4">
          <p className="text-xs text-muted-foreground">
            The {paymentIds.length} selected due{paymentIds.length !== 1 ? "s" : ""} come to{" "}
            <span className="font-semibold text-foreground">{formatCurrency(total)}</span>. You can report any amount you paid:
            it clears the dues you selected first, then the oldest, and any extra stays as your credit.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount you paid (₹)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              inputMode="decimal"
              min="1"
              step="0.01"
              defaultValue={total > 0 ? total : undefined}
              key={total}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="utrNumber">UTR / transaction ID</Label>
            <p className="text-[11px] text-muted-foreground">Find it in your UPI app&apos;s payment details.</p>
            <Input
              id="utrNumber"
              name="utrNumber"
              placeholder="e.g. 412345678901"
              autoComplete="off"
              inputMode="text"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="paidOn">Paid on</Label>
            <Input id="paidOn" name="paidOn" type="date" defaultValue={today} max={today} required />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending…" : "Send for verification"}
          </Button>
        </form>
      )}
    </div>
  );
}
