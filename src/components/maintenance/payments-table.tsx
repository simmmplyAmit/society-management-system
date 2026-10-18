"use client";

import { Badge } from "@/components/ui/badge";
import { MONTHS } from "@/lib/utils/month";
import { MarkPaidForm } from "./mark-paid-form";
import { RemindButton } from "./remind-button";
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

interface Payment {
  id: string;
  month: number;
  year: number;
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
  limit?: number;
}

export function PaymentsTable({ payments, canManage, societyUpiId, hasWings, limit }: PaymentsTableProps) {
  if (payments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center">
        <p className="text-sm font-medium">No dues match these filters</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Try another month or flat, or generate dues from the &ldquo;Generate dues&rdquo; tab.
        </p>
      </div>
    );
  }

  const total = payments.reduce((t, p) => t + Number(p.amount), 0);
  const unpaidIds = payments.filter((p) => p.status !== "PAID").map((p) => p.id);
  const flatCount = new Set(payments.map((p) => `${p.flat.floor.wing.name}-${p.flat.floor.number}-${p.flat.number}`)).size;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-card p-4 ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <p className="text-xs font-medium text-muted-foreground">Total shown</p>
        <p className="text-2xl font-semibold">{formatCurrency(total)}</p>
        <p className="text-xs text-muted-foreground">
          {payments.length} due{payments.length !== 1 ? "s" : ""} · {flatCount} flat{flatCount !== 1 ? "s" : ""}
        </p>
        {societyUpiId && (
          <p className="mt-3 text-xs text-muted-foreground">
            Pay to UPI: <span className="font-semibold text-foreground">{societyUpiId}</span>
          </p>
        )}
        {canManage && unpaidIds.length > 0 && (
          <RemindButton
            paymentIds={unpaidIds}
            label={`Send reminders (${unpaidIds.length})`}
            variant="outline"
            className="mt-3 h-9"
            confirmMessage={`Email and SMS ${unpaidIds.length} unpaid due${unpaidIds.length !== 1 ? "s" : ""} to their residents?`}
          />
        )}
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {payments.map((payment) => {
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
                    <span className="font-medium text-foreground/70">
                      {MONTHS[payment.month - 1].slice(0, 3)} {payment.year}
                    </span>
                    {" · "}
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
              {canManage && (
                <div className="flex flex-wrap items-center gap-2">
                  <MarkPaidForm paymentId={payment.id} status={payment.status} />
                  {payment.status !== "PAID" && (
                    <RemindButton paymentIds={[payment.id]} className="mt-2 h-8 text-xs text-muted-foreground" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {limit && payments.length >= limit && (
        <p className="text-center text-xs text-muted-foreground">
          Showing the latest {limit} dues. Narrow by month or flat to see the rest.
        </p>
      )}
    </div>
  );
}
