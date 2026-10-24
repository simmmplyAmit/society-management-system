"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { collectCash } from "@/actions/cash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils/month";
import type { MemberOption } from "./record-deposit-form";

/** Take cash from a resident: issues a numbered receipt and credits their account straight away. */
export function CollectCashForm({ members }: { members: MemberOption[] }) {
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().split("T")[0];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const amount = Number(fd.get("amount"));
    if (!window.confirm(`Receive ${formatCurrency(amount)} in cash? A numbered receipt is issued and it can't be edited afterwards.`)) return;
    startTransition(async () => {
      const r = await collectCash(fd);
      if ("error" in r && r.error) return void toast.error(r.error);
      const res = r as { receiptNo: number; applied: number; balance: number };
      toast.success(
        `Receipt #${res.receiptNo} issued. ${res.applied} due${res.applied !== 1 ? "s" : ""} paid` +
          (res.balance > 0 ? `, ${formatCurrency(res.balance)} kept as credit` : "")
      );
      form.reset();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Any amount works. It is added to the member&apos;s credit and pays their dues, and the cash is now with you until you deposit it.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="cash-user">Received from</Label>
        <select
          id="cash-user"
          name="userId"
          required
          defaultValue=""
          className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="" disabled>Choose a member</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cash-amount">Amount (₹)</Label>
          <Input id="cash-amount" name="amount" type="number" inputMode="decimal" min="1" step="0.01" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cash-date">Received on</Label>
          <Input id="cash-date" name="receivedOn" type="date" defaultValue={today} max={today} required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cash-note">Note (optional)</Label>
        <Input id="cash-note" name="note" maxLength={200} placeholder="e.g. Handed over at the office" />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Recording…" : "Receive cash and issue receipt"}
      </Button>
    </form>
  );
}
