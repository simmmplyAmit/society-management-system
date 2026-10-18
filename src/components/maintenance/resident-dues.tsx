import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, monthLabel } from "@/lib/utils/month";
import { flatLabel } from "@/lib/utils/flat";
import { CheckCircle2, Clock } from "lucide-react";
import { buildUpiLink } from "@/lib/utils/upi";

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

  const totalDue = pending.reduce((sum, p) => sum + Number(p.amount), 0);
  const upiLink = buildUpiLink({
    upiId: societyUpiId,
    payeeName: societyName,
    amount: totalDue,
    note: "Maintenance dues",
  });

  return (
    <div className="space-y-4">
      {totalDue > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-xs text-amber-600 font-medium">Total Due</p>
            <p className="text-2xl font-bold text-amber-700">{formatCurrency(totalDue)}</p>
            {societyUpiId && (
              <p className="text-xs text-amber-600 mt-1">
                Pay to: <span className="font-semibold">{societyUpiId}</span>
              </p>
            )}
            {upiLink && (
              <a
                href={upiLink}
                className="mt-3 inline-block rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
              >
                Pay {formatCurrency(totalDue)} via UPI
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {totalDue === 0 && payments.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <p className="text-sm font-medium text-green-700">All dues cleared!</p>
          </CardContent>
        </Card>
      )}

      {pending.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Pending Dues</h3>
          <div className="space-y-2">
            {pending.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {monthLabel(p.month, p.year)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {flatLabel(p.flat, hasWings)}
                    </p>
                  </div>
                  <span className="font-semibold text-sm shrink-0">
                    {formatCurrency(p.amount)}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {paid.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
            Payment History
          </h3>
          <div className="space-y-2">
            {paid.slice(0, 12).map((p) => (
              <Card key={p.id} className="opacity-70">
                <CardContent className="p-3 flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{monthLabel(p.month, p.year)}</p>
                    <p className="text-xs text-muted-foreground">
                      Paid {formatDate(p.paidAt)}
                      {p.utrNumber && ` · UTR: ${p.utrNumber}`}
                    </p>
                  </div>
                  <span className="text-sm text-green-700 font-medium shrink-0">
                    {formatCurrency(p.amount)}
                  </span>
                </CardContent>
              </Card>
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
