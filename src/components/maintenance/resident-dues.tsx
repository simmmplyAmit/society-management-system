"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, monthLabel } from "@/lib/utils/month";
import { flatLabel } from "@/lib/utils/flat";
import { CheckCircle2 } from "lucide-react";
import { buildUpiLink } from "@/lib/utils/upi";
import { dueBalance, duesNote, selectedTotal } from "@/lib/utils/dues";
import { ReportPaymentForm } from "./report-payment-form";

type PaymentStatus = "PENDING" | "PAID" | "OVERDUE";

interface Payment {
  id: string;
  flatId: string;
  amount: string | number;
  amountPaid?: string | number | null;
  month: number;
  year: number;
  status: PaymentStatus;
  paidAt: Date | null;
  utrNumber: string | null;
  claim?: { id: string; status: "SUBMITTED" | "APPROVED" | "REJECTED" } | null;
  flat: {
    number: string;
    floor: { number: number; wing: { name: string } };
  };
}

interface Claim {
  id: string;
  utrNumber: string;
  amount: string | number;
  status: "SUBMITTED" | "APPROVED" | "REJECTED";
  reviewNote: string | null;
  createdAt: Date;
}

export interface FlatChip {
  id: string;
  number: string;
  floor: { number: number; wing: { name: string } };
  type: "OWNER" | "TENANT";
}

export interface CreditMove {
  id: string;
  type: "DEPOSIT" | "APPLIED" | "REVERSAL";
  amount: string | number;
  note: string | null;
  createdAt: Date;
}

interface ResidentDuesProps {
  /** Spare money the member holds with the society; it pays new dues automatically. */
  creditBalance?: number;
  creditActivity?: CreditMove[];
  payments: Payment[];
  /** Every flat the user is linked to. With more than one, a flat switcher appears. */
  flats?: FlatChip[];
  initialFlatId?: string;
  claims?: Claim[];
  societyUpiId?: string | null;
  societyName?: string | null;
  hasWings?: boolean;
}

export function ResidentDues({
  payments: allPayments,
  creditBalance = 0,
  creditActivity = [],
  flats = [],
  initialFlatId,
  claims = [],
  societyUpiId,
  societyName,
  hasWings = true,
}: ResidentDuesProps) {
  const multiFlat = flats.length > 1;
  const [activeFlat, setActiveFlat] = useState<string>(
    multiFlat && initialFlatId && flats.some((f) => f.id === initialFlatId) ? initialFlatId : "all"
  );
  // "All flats" is the unified view; picking a flat narrows every section below
  const payments = allPayments.filter((p) => activeFlat === "all" || p.flatId === activeFlat);
  const unpaid = payments.filter((p) => p.status !== "PAID");
  // Dues already reported as paid wait for the treasurer, so they can't be selected again
  const underReview = unpaid.filter((p) => p.claim?.status === "SUBMITTED");
  const pending = unpaid.filter((p) => p.claim?.status !== "SUBMITTED");
  const paid = payments.filter((p) => p.status === "PAID");

  // Everything is selected to start with, so "pay all" stays one tap
  const isOpen = (p: Payment) => p.status !== "PAID" && p.claim?.status !== "SUBMITTED";
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(payments.filter(isOpen).map((p) => p.id))
  );

  function chooseFlat(id: string) {
    setActiveFlat(id);
    // Selection restarts as "everything due" in the newly chosen scope
    setSelectedIds(
      new Set(allPayments.filter((p) => (id === "all" || p.flatId === id) && isOpen(p)).map((p) => p.id))
    );
  }

  const selected = pending.filter((p) => selectedIds.has(p.id));
  const totalDue = selectedTotal(pending);
  const payTotal = selectedTotal(selected);
  const allSelected = selected.length === pending.length;

  const upiLink = buildUpiLink({
    upiId: societyUpiId,
    payeeName: societyName,
    amount: payTotal,
    note: duesNote(selected),
  });

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const unpaidByFlat = new Map<string, number>();
  for (const p of allPayments) {
    if (p.status !== "PAID") unpaidByFlat.set(p.flatId, (unpaidByFlat.get(p.flatId) ?? 0) + dueBalance(p));
  }
  const unpaidAll = [...unpaidByFlat.values()].reduce((a, b) => a + b, 0);
  const activeFlatInfo = flats.find((f) => f.id === activeFlat);

  return (
    <div className="space-y-4">
      {(creditBalance > 0 || creditActivity.length > 0) && (
        <div className="rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-600/15">
          <p className="text-xs font-medium text-emerald-700">Your credit</p>
          <p className="text-2xl font-semibold text-emerald-800">{formatCurrency(creditBalance)}</p>
          <p className="mt-1 text-xs text-emerald-800/80">
            Spare money you have paid in. It is applied to your dues automatically, oldest first, and can only be used for dues.
          </p>
        </div>
      )}

      {multiFlat && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {[{ id: "all", label: "All flats", amount: unpaidAll, sub: `${flats.length} flats` }, ...flats.map((f) => ({
            id: f.id,
            label: flatLabel(f, hasWings),
            amount: unpaidByFlat.get(f.id) ?? 0,
            sub: f.type === "OWNER" ? "Owner" : "Tenant",
          }))].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => chooseFlat(c.id)}
              aria-pressed={activeFlat === c.id}
              className={cn(
                "shrink-0 rounded-xl px-3.5 py-2 text-left transition-colors",
                activeFlat === c.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card ring-1 ring-border hover:bg-muted/50"
              )}
            >
              <span className="block text-xs font-semibold">{c.label}</span>
              <span className={cn("block text-[11px]", activeFlat === c.id ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {c.amount > 0 ? `${formatCurrency(c.amount)} due` : "All paid"} · {c.sub}
              </span>
            </button>
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-3">
        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-5 text-white shadow-lg shadow-indigo-500/20">
          <p className="text-sm text-white/80">
            {allSelected ? (activeFlatInfo ? `Due for ${flatLabel(activeFlatInfo, hasWings)}` : "Total due") : `Paying ${selected.length} of ${pending.length} dues`}
          </p>
          <p className="mt-1 text-4xl font-semibold tracking-tight">{formatCurrency(payTotal)}</p>
          {!allSelected && (
            <p className="mt-1 text-xs text-white/70">Total outstanding {formatCurrency(totalDue)}</p>
          )}
          {societyUpiId && (
            <p className="mt-3 text-xs text-white/80">
              Pay to: <span className="font-semibold text-white">{societyUpiId}</span>
            </p>
          )}
          {upiLink && selected.length > 0 ? (
            <a
              href={upiLink}
              className="mt-4 flex h-11 w-full items-center justify-center rounded-lg bg-white text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
            >
              Pay {formatCurrency(payTotal)} via UPI
            </a>
          ) : (
            selected.length === 0 && (
              <p className="mt-4 rounded-lg bg-white/15 px-3 py-2 text-center text-sm">
                Select at least one due to pay
              </p>
            )
          )}
          <p className="mt-3 text-[11px] leading-snug text-white/70">
            After paying, enter the UPI reference below so your society can confirm it.
          </p>
        </div>
        <ReportPaymentForm paymentIds={selected.map((p) => p.id)} total={payTotal} />
        </div>
      )}

      {underReview.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Awaiting verification</h3>
          <div className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border">
            {underReview.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{monthLabel(p.month, p.year)}</p>
                  <p className="text-xs text-muted-foreground">{flatLabel(p.flat, hasWings)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold">{formatCurrency(dueBalance(p))}</p>
                  <Badge variant="info" className="mt-0.5">Awaiting verification</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {unpaid.length === 0 && payments.length > 0 && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="flex items-center gap-2 p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <p className="text-sm font-medium text-emerald-700">All dues cleared!</p>
          </CardContent>
        </Card>
      )}

      {pending.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Pending dues</h3>
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:underline"
              onClick={() => setSelectedIds(allSelected ? new Set() : new Set(pending.map((p) => p.id)))}
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
          </div>
          <div className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            {pending.map((p) => {
              const checked = selectedIds.has(p.id);
              return (
                <label
                  key={p.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors",
                    checked ? "bg-primary/5" : "hover:bg-muted/50"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p.id)}
                    className="size-4 shrink-0 accent-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{monthLabel(p.month, p.year)}</p>
                    <p className="text-xs text-muted-foreground">{flatLabel(p.flat, hasWings)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">{formatCurrency(dueBalance(p))}</p>
                    {Number(p.amountPaid ?? 0) > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        {formatCurrency(Number(p.amountPaid))} of {formatCurrency(p.amount)} paid
                      </p>
                    )}
                    <Badge
                      variant={Number(p.amountPaid ?? 0) > 0 ? "info" : p.status === "OVERDUE" ? "danger" : "warning"}
                      className="mt-0.5"
                    >
                      {Number(p.amountPaid ?? 0) > 0 ? "Part paid" : p.status === "OVERDUE" ? "Overdue" : "Pending"}
                    </Badge>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {claims[0]?.status === "REJECTED" && (
        <div className="rounded-xl bg-rose-50 p-3 text-sm ring-1 ring-rose-600/15">
          <p className="font-semibold text-rose-700">
            Your report {claims[0].utrNumber} for {formatCurrency(claims[0].amount)} was not accepted
          </p>
          <p className="mt-0.5 text-xs text-rose-700/80">
            {claims[0].reviewNote ? `Reason: ${claims[0].reviewNote}. ` : ""}The dues are open again. Check the
            reference and report it again.
          </p>
        </div>
      )}

      {creditActivity.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Credit activity</h3>
          <div className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border">
            {creditActivity.map((m) => {
              const amt = Number(m.amount);
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {m.type === "DEPOSIT" ? "Payment received" : m.type === "APPLIED" ? "Applied to dues" : "Returned to credit"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(m.createdAt)}
                      {m.note ? ` · ${m.note}` : ""}
                    </p>
                  </div>
                  <span className={cn("shrink-0 text-sm font-semibold", amt >= 0 ? "text-emerald-700" : "text-muted-foreground")}>
                    {amt >= 0 ? "+" : "−"}{formatCurrency(Math.abs(amt))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {paid.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Payment history</h3>
          <div className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border">
            {paid.slice(0, 12).map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{monthLabel(p.month, p.year)}</p>
                  <p className="text-xs text-muted-foreground">
                    Paid {formatDate(p.paidAt)}
                    {p.utrNumber && ` · UTR: ${p.utrNumber}`}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium text-emerald-700">
                  {formatCurrency(p.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {payments.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No maintenance records yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
