"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, monthLabel } from "@/lib/utils/month";
import { flatLabel } from "@/lib/utils/flat";
import { CheckCircle2 } from "lucide-react";
import { buildUpiLink } from "@/lib/utils/upi";
import { duesNote, selectedTotal } from "@/lib/utils/dues";

type PaymentStatus = "PENDING" | "PAID" | "OVERDUE";

interface Payment {
  id: string;
  amount: string | number;
  month: number;
  year: number;
  status: PaymentStatus;
  paidAt: Date | null;
  utrNumber: string | null;
  flat: {
    number: string;
    floor: { number: number; wing: { name: string } };
  };
}

interface ResidentDuesProps {
  payments: Payment[];
  societyUpiId?: string | null;
  societyName?: string | null;
  hasWings?: boolean;
}

export function ResidentDues({ payments, societyUpiId, societyName, hasWings = true }: ResidentDuesProps) {
  const pending = payments.filter((p) => p.status !== "PAID");
  const paid = payments.filter((p) => p.status === "PAID");

  // Everything is selected to start with, so "pay all" stays one tap
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(pending.map((p) => p.id)));

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

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-5 text-white shadow-lg shadow-indigo-500/20">
          <p className="text-sm text-white/80">
            {allSelected ? "Total due" : `Paying ${selected.length} of ${pending.length} dues`}
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
            Your society marks dues as paid after it receives the money, so it can take a little while to show up here.
          </p>
        </div>
      )}

      {pending.length === 0 && payments.length > 0 && (
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
                    <p className="text-sm font-semibold">{formatCurrency(p.amount)}</p>
                    <Badge variant={p.status === "OVERDUE" ? "danger" : "warning"} className="mt-0.5">
                      {p.status === "OVERDUE" ? "Overdue" : "Pending"}
                    </Badge>
                  </div>
                </label>
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
