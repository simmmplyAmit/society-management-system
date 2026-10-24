"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { recordDeposit } from "@/actions/credit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountFields, type AccountOption } from "@/components/bank/account-fields";
import { formatCurrency } from "@/lib/utils/month";

export interface MemberOption {
  id: string;
  label: string; // "Name · A-101, B-202"
}

/** Treasurer records money received directly (cash, cheque, UPI) in any amount. */
export function RecordDepositForm({ members, accounts = [] }: { members: MemberOption[]; accounts?: AccountOption[] }) {
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().split("T")[0];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const r = await recordDeposit(fd);
      if ("error" in r && r.error) return void toast.error(r.error);
      const res = r as { applied: number; balance: number };
      toast.success(
        `Recorded. ${res.applied} due${res.applied !== 1 ? "s" : ""} paid` +
          (res.balance > 0 ? `, ${formatCurrency(res.balance)} kept as credit` : "")
      );
      form.reset();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-xs text-muted-foreground">
        For money that has already reached the society&apos;s bank account outside the app. Any amount works: it is added to the member&apos;s credit and pays their
        oldest dues first.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="dep-user">Member</Label>
        <select
          id="dep-user"
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
          <Label htmlFor="dep-amount">Amount (₹)</Label>
          <Input id="dep-amount" name="amount" type="number" inputMode="decimal" min="1" step="0.01" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dep-date">Received on</Label>
          <Input id="dep-date" name="paidOn" type="date" defaultValue={today} max={today} required />
        </div>
      </div>
      <AccountFields accounts={accounts} showChannel={false} />
      <div className="space-y-1.5">
        <Label htmlFor="dep-ref">UTR / reference (optional)</Label>
        <Input id="dep-ref" name="reference" autoComplete="off" placeholder="e.g. 412345678901" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dep-note">Note (optional)</Label>
        <Input id="dep-note" name="note" maxLength={200} placeholder="e.g. Cash received at office" />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Recording…" : "Record payment"}
      </Button>
    </form>
  );
}
