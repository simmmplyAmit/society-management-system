import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/month";
import { MONTHS } from "@/lib/utils/month";

interface MonthlySummary {
  month: number;
  total: number;
}

interface ExpenseSummaryProps {
  monthly: MonthlySummary[];
  byCategory: Record<string, number>;
  grandTotal: number;
  year: number;
}

export function ExpenseSummary({
  monthly,
  byCategory,
  grandTotal,
  year,
}: ExpenseSummaryProps) {
  const activeMonths = monthly.filter((m) => m.total > 0);
  const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const maxMonthly = Math.max(...monthly.map((m) => m.total), 1);

  return (
    <div className="space-y-4">
      {/* Year total */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total Expenses {year}</p>
          <p className="text-2xl font-bold">{formatCurrency(grandTotal)}</p>
        </CardContent>
      </Card>

      {/* Monthly bar chart (simple CSS bars) */}
      {activeMonths.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">Monthly Breakdown</p>
            <div className="space-y-2">
              {monthly.map((m) => (
                <div key={m.month} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-7 shrink-0">
                    {MONTHS[m.month - 1].slice(0, 3)}
                  </span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-slate-800 h-2 rounded-full transition-all"
                      style={{ width: `${(m.total / maxMonthly) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-medium w-16 text-right shrink-0">
                    {m.total > 0 ? formatCurrency(m.total) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* By category */}
      {sortedCategories.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">By Category</p>
            <div className="space-y-2">
              {sortedCategories.map(([cat, total]) => (
                <div key={cat} className="flex items-center justify-between">
                  <span className="text-sm truncate">{cat}</span>
                  <span className="text-sm font-semibold shrink-0 ml-2">
                    {formatCurrency(total)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
