"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MarkPaidForm } from "./mark-paid-form";
import { formatCurrency, formatDate } from "@/lib/utils/month";
import { flatLabel } from "@/lib/utils/flat";


type PaymentStatus = "PENDING" | "PAID" | "OVERDUE";

const STATUS_CONFIG: Record<
  PaymentStatus,
  { label: string; variant: "success" | "warning" | "danger" }
> = {
  PAID: { label: "Paid", variant: "success" },
  PENDING: { label: "Pending", variant: "warning" },
  OVERDUE: { label: "Overdue", variant: "danger" },
};

type Filter = "ALL" | PaymentStatus;

interface Payment {
  id: string;
  amount: string | number;
  status: PaymentStatus;
  paidAt: Date | null;
  utrNumber: string | null;
  notes: string | null;
  flat: {
    number: string;
    floor: { number: number; wing: { name: string } };
    residents: {
      user: { name: string; phone: string | null };
    }[];
  };
}

interface PaymentsTableProps {
  payments: Payment[];
  canManage: boolean;
  societyUpiId?: string | null;
  hasWings: boolean;
}

export function PaymentsTable({ payments, canManage, societyUpiId, hasWings }: PaymentsTableProps) {
  const [filter, setFilter] = useState<Filter>("ALL");

  if (payments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center">
        <p className="text-sm font-medium">No records for this month</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Open &ldquo;Generate dues&rdquo; below to create them.
        </p>
      </div>
    );
  }

  const sum = (s: PaymentStatus | "ALL") =>
    payments
      .filter((p) => s === "ALL" || p.status === s)
      .reduce((t, p) => t + Number(p.amount), 0);
  const count = (s: PaymentStatus) => payments.filter((p) => p.status === s).length;
  const collected = sum("PAID");
  const billed = sum("ALL");
  const pct = billed > 0 ? Math.round((collected / billed) * 100) : 0;

  const FILTERS: { key: Filter; label: string; n: number }[] = [
    { key: "ALL", label: "All", n: payments.length },
    { key: "PENDING", label: "Pending", n: count("PENDING") },
    { key: "OVERDUE", label: "Overdue", n: count("OVERDUE") },
    { key: "PAID", label: "Paid", n: count("PAID") },
  ];
  const visible = payments.filter((p) => filter === "ALL" || p.status === filter);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-card p-4 ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Collected</p>
            <p className="text-2xl font-semibold">{formatCurrency(collected)}</p>
          </div>
          <p className="text-right text-xs text-muted-foreground">
            of {formatCurrency(billed)}
            <br />
            {pct}%
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        {societyUpiId && (
          <p className="mt-3 text-xs text-muted-foreground">
            Pay to UPI: <span className="font-semibold text-foreground">{societyUpiId}</span>
          </p>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground"
            )}
          >
            {f.label} <span className="opacity-70">{f.n}</span>
          </button>
        ))}
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {visible.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">Nothing here.</p>
        )}
        {visible.map((payment) => {
          const config = STATUS_CONFIG[payment.status];
          const resident = payment.flat.residents[0];
          return (
            <div key={payment.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {flatLabel(payment.flat, hasWings)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {resident
                      ? `${resident.user.name}${resident.user.phone ? ` · ${resident.user.phone}` : ""}`
                      : "No resident assigned"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold">{formatCurrency(payment.amount)}</p>
                  <Badge variant={config.variant} className="mt-1">
                    {config.label}
                  </Badge>
                </div>
              </div>
              {payment.status === "PAID" && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {formatDate(payment.paidAt)}
                  {payment.utrNumber && ` · UTR ${payment.utrNumber}`}
                </p>
              )}
              {canManage && <MarkPaidForm paymentId={payment.id} status={payment.status} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
