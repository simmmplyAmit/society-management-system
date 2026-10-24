"use client";

import { useTransition } from "react";
import { addBankAccount, setPrimaryBankAccount, recordBalanceCheck } from "@/actions/bank";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils/month";

export function AddBankAccountForm({ first }: { first?: boolean }) {
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().split("T")[0];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const r = await addBankAccount(fd);
      if ("error" in r && r.error) return void toast.error(r.error);
      toast.success("Bank account added");
      form.reset();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="ba-name">Account name *</Label>
        <Input id="ba-name" name="name" placeholder="e.g. Maintenance savings" required minLength={2} maxLength={60} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ba-bank">Bank</Label>
          <Input id="ba-bank" name="bankName" placeholder="Kotak" maxLength={60} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ba-last4">Last 4 digits</Label>
          <Input id="ba-last4" name="last4" inputMode="numeric" pattern="\d{4}" maxLength={4} placeholder="1234" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ba-open">Opening balance (₹) *</Label>
          <Input id="ba-open" name="openingBalance" type="number" inputMode="decimal" min="0" step="0.01" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ba-date">As on *</Label>
          <Input id="ba-date" name="openingDate" type="date" defaultValue={today} max={today} required />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {first ? "Use the balance on your bank statement at the start of the day you pick. " : ""}
        Only money recorded from that date onwards is counted, so choose a date you have a statement balance for.
        {" "}You can&apos;t change the opening balance later.
      </p>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Adding…" : "Add account"}
      </Button>
    </form>
  );
}

export function MakePrimaryButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 text-xs"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await setPrimaryBankAccount(id);
          if ("error" in r && r.error) toast.error(r.error);
          else toast.success("Primary account changed");
        })
      }
    >
      Make primary
    </Button>
  );
}

export function BalanceCheckForm({ accountId }: { accountId: string }) {
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().split("T")[0];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const r = await recordBalanceCheck(fd);
      if ("error" in r && r.error) return void toast.error(r.error);
      const res = r as { expected: number; difference: number };
      if (res.difference === 0) toast.success(`Tallies: the bank statement matches the app (${formatCurrency(res.expected)})`);
      else
        toast.warning(
          `Difference of ${formatCurrency(Math.abs(res.difference))}: the bank shows ${res.difference > 0 ? "more" : "less"} than the app expects (${formatCurrency(res.expected)})`
        );
      form.reset();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input type="hidden" name="bankAccountId" value={accountId} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`chk-bal-${accountId}`}>Balance on statement (₹)</Label>
          <Input id={`chk-bal-${accountId}`} name="statementBalance" type="number" inputMode="decimal" step="0.01" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`chk-date-${accountId}`}>Statement date</Label>
          <Input id={`chk-date-${accountId}`} name="asOf" type="date" defaultValue={today} max={today} required />
        </div>
      </div>
      <Input name="note" maxLength={200} placeholder="Note (optional)" />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Checking…" : "Compare with the app"}
      </Button>
    </form>
  );
}
