"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarkPaidForm } from "./mark-paid-form";
import { formatCurrency, formatDate } from "@/lib/utils/month";
import { flatLabel } from "@/lib/utils/flat";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";

type PaymentStatus = "PENDING" | "PAID" | "OVERDUE";

const STATUS_CONFIG: Record<
  PaymentStatus,
  { icon: React.ElementType; label: string; badge: string }
> = {
  PAID: { icon: CheckCircle2, label: "Paid", badge: "bg-green-100 text-green-700" },
  PENDING: { icon: Clock, label: "Pending", badge: "bg-amber-100 text-amber-700" },
  OVERDUE: { icon: AlertCircle, label: "Overdue", badge: "bg-red-100 text-red-700" },
};

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
  if (payments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No payment records for this month. Generate records above.
      </p>
    );
  }

  const paid = payments.filter((p) => p.status === "PAID").length;

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">{payments.length} flats total</span>
        <span className="text-green-600 font-medium">{paid} paid</span>
        <span className="text-amber-600 font-medium">{payments.length - paid} pending</span>
      </div>

      {societyUpiId && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
          Society UPI: <span className="font-semibold">{societyUpiId}</span>
        </div>
      )}

      {payments.map((payment) => {
        const config = STATUS_CONFIG[payment.status];
        const Icon = config.icon;
        const primaryResident = payment.flat.residents[0];

        return (
          <Card key={payment.id}>
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${
                  payment.status === "PAID" ? "text-green-500" :
                  payment.status === "OVERDUE" ? "text-red-500" : "text-amber-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-medium text-sm">
                        {flatLabel(payment.flat, hasWings)}
                      </span>
                      {primaryResident && (
                        <p className="text-xs text-muted-foreground">
                          {primaryResident.user.name}
                          {primaryResident.user.phone && ` · ${primaryResident.user.phone}`}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-sm">{formatCurrency(payment.amount)}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${config.badge}`}>
                        {config.label}
                      </span>
                    </div>
                  </div>

                  {payment.status === "PAID" && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDate(payment.paidAt)}
                      {payment.utrNumber && ` · UTR: ${payment.utrNumber}`}
                    </div>
                  )}

                  {canManage && (
                    <MarkPaidForm paymentId={payment.id} status={payment.status} />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
