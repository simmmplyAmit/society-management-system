"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { confirmCashDeposit, depositCash } from "@/actions/cash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/utils/month";

export interface InHandRow {
  id: string;
  receiptNo: number;
  amount: number;
  receivedOn: Date;
  payerName: string;
  collectorId: string;
  collectorName: string;
}

export interface DepositRow {
  id: string;
  amount: number;
  depositedOn: Date;
  reference: string;
  depositedById: string;
  depositedByName: string;
  confirmedByName: string | null;
  count: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function CashDepositPanel({
  inHand,
  deposits,
  currentUserId,
  staleDays,
}: {
  inHand: InHandRow[];
  deposits: DepositRow[];
  currentUserId: string;
  staleDays: number;
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const today = new Date().toISOString().split("T")[0];
  const [now] = useState(() => Date.now());

  const total = useMemo(
    () => Math.round(inHand.filter((r) => selected.has(r.id)).reduce((n, r) => n + r.amount * 100, 0)) / 100,
    [inHand, selected]
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    for (const id of selected) fd.append("collectionId", id);
    startTransition(async () => {
      const r = await depositCash(fd);
      if ("error" in r && r.error) return void toast.error(r.error);
      const res = r as { amount: number; count: number };
      toast.success(`Deposit of ${formatCurrency(res.amount)} recorded (${res.count} receipt${res.count !== 1 ? "s" : ""})`);
      setSelected(new Set());
      form.reset();
    });
  }

  function confirm(id: string) {
    startTransition(async () => {
      const r = await confirmCashDeposit(id);
      if ("error" in r && r.error) return void toast.error(r.error);
      toast.success("Deposit confirmed");
    });
  }

  return (
    <div className="space-y-5">
      {inHand.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Cash to deposit</h3>
            <div className="flex gap-3 text-xs font-semibold text-primary">
              <button type="button" onClick={() => setSelected(new Set(inHand.filter((r) => r.collectorId === currentUserId).map((r) => r.id)))}>
                Select mine
              </button>
              <button type="button" onClick={() => setSelected(new Set(inHand.map((r) => r.id)))}>All</button>
              <button type="button" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          </div>
          <div className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            {inHand.map((r) => {
              const days = Math.floor((now - r.receivedOn.getTime()) / DAY_MS);
              const stale = days >= staleDays;
              return (
                <label
                  key={r.id}
                  className={cn("flex cursor-pointer items-center gap-3 px-4 py-3", selected.has(r.id) ? "bg-primary/5" : "hover:bg-muted/50")}
                >
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="size-4 shrink-0 accent-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      #{r.receiptNo} · {r.payerName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(r.receivedOn)} · held by {r.collectorName}
                      {stale && <span className="font-medium text-amber-700"> · {days} days</span>}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">{formatCurrency(r.amount)}</span>
                </label>
              );
            })}
          </div>

          <form onSubmit={submit} className="mt-3 space-y-3 rounded-xl bg-card p-4 ring-1 ring-border">
            <p className="text-sm font-semibold">
              Deposit {selected.size > 0 ? `${formatCurrency(total)} (${selected.size} receipt${selected.size !== 1 ? "s" : ""})` : "selected cash"}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="dep-ref">Bank slip no. / reference</Label>
              <Input id="dep-ref" name="reference" required minLength={4} maxLength={40} autoComplete="off" placeholder="Slip no. or reference" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dep-on">Deposited on</Label>
                <Input id="dep-on" name="depositedOn" type="date" defaultValue={today} max={today} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dep-note">Note (optional)</Label>
                <Input id="dep-note" name="note" maxLength={200} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={pending || selected.size === 0}>
              {pending ? "Recording…" : "Record deposit"}
            </Button>
          </form>
        </div>
      )}

      {inHand.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No cash waiting to be deposited.
        </div>
      )}

      {deposits.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Recent deposits</h3>
          <div className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border">
            {deposits.map((d) => (
              <div key={d.id} className="space-y-1 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{formatCurrency(d.amount)}</p>
                  {d.confirmedByName ? <Badge variant="success">Confirmed</Badge> : <Badge variant="warning">Awaiting confirmation</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(d.depositedOn)} · ref {d.reference} · {d.count} receipt{d.count !== 1 ? "s" : ""} · by {d.depositedByName}
                  {d.confirmedByName ? ` · confirmed by ${d.confirmedByName}` : ""}
                </p>
                {!d.confirmedByName && d.depositedById === currentUserId && (
                  <p className="text-[11px] text-muted-foreground">Another admin or treasurer confirms it against the bank statement.</p>
                )}
                {!d.confirmedByName && d.depositedById !== currentUserId && (
                  <Button type="button" variant="outline" size="sm" className="mt-1 h-8 text-xs" disabled={pending} onClick={() => confirm(d.id)}>
                    Confirm it is on the bank statement
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
