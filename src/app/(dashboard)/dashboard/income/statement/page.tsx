import Link from "next/link";
import { requireRole } from "@/lib/session";
import { getStatement } from "@/lib/queries/income";
import { formatCurrency, MONTHS } from "@/lib/utils/month";
import { YearSelector } from "@/components/expenses/year-selector";
import { ChevronLeft } from "lucide-react";
import { PageTitle } from "@/components/ui/page-title";

const card = "rounded-xl bg-card p-4 ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]";

export default async function StatementPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await requireRole(["ADMIN", "SECRETARY", "TREASURER"]);
  const sp = await searchParams;
  const parsedYear = parseInt(sp.year ?? "", 10);
  const year = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();

  const s = await getStatement(session.user.societyId!, year);
  const t = s.totals;
  const totalIn = t.dues + t.otherIncome;
  const paidFromFunds = t.expenses - t.memberPaid;

  return (
    <div className="space-y-5">
      <Link href="/dashboard/income" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Other income
      </Link>
      <div className="flex items-center justify-between">
        <PageTitle emoji="📊">Statement</PageTitle>
        <YearSelector year={year} />
      </div>
      <p className="-mt-3 text-sm text-muted-foreground">
        Cash basis for {year}: money received against money spent. Dues received counts payments added to members&apos;
        credit (UPI, cash, cheque), not what was billed.
      </p>

      <div className={`${card} space-y-2 text-sm`}>
        <p className="text-xs font-medium text-muted-foreground">Receipts</p>
        <Line label="Dues and charges received" value={t.dues} />
        <Line label="Other income" value={t.otherIncome} />
        <Line label="Total received" value={totalIn} bold />
        <p className="pt-2 text-xs font-medium text-muted-foreground">Payments</p>
        <Line label="Expenses" value={t.expenses} />
        {t.memberPaid > 0 && (
          <Line label="Less: paid by members (settled against their dues)" value={-t.memberPaid} muted />
        )}
        <Line label="Paid from society funds" value={paidFromFunds} bold />
        <div className="border-t border-border pt-2">
          <Line label={t.net >= 0 ? "Surplus" : "Deficit"} value={t.net} bold tone={t.net >= 0 ? "pos" : "neg"} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Breakdown title="Other income by type" rows={s.incomeByCategory} />
        <Breakdown title="Expenses by type" rows={s.expenseByCategory} />
      </div>

      <div className={`${card} overflow-x-auto p-0`}>
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Month</th>
              <th className="px-3 py-2 text-right font-medium">Dues</th>
              <th className="px-3 py-2 text-right font-medium">Other</th>
              <th className="px-3 py-2 text-right font-medium">Expenses</th>
              <th className="px-3 py-2 text-right font-medium">Net</th>
            </tr>
          </thead>
          <tbody>
            {s.months.map((m) => (
              <tr key={m.month} className="border-b border-border last:border-0">
                <td className="px-3 py-2">{MONTHS[m.month - 1].slice(0, 3)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(m.dues)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(m.otherIncome)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(m.expenses)}</td>
                <td className={`px-3 py-2 text-right font-medium ${m.net < 0 ? "text-destructive" : ""}`}>{formatCurrency(m.net)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/40 font-semibold">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-right">{formatCurrency(t.dues)}</td>
              <td className="px-3 py-2 text-right">{formatCurrency(t.otherIncome)}</td>
              <td className="px-3 py-2 text-right">{formatCurrency(t.expenses)}</td>
              <td className={`px-3 py-2 text-right ${t.net < 0 ? "text-destructive" : ""}`}>{formatCurrency(t.net)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Line({
  label, value, bold, muted, tone,
}: { label: string; value: number; bold?: boolean; muted?: boolean; tone?: "pos" | "neg" }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${bold ? "font-semibold" : ""} ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className={tone === "pos" ? "text-emerald-700" : tone === "neg" ? "text-destructive" : ""}>{formatCurrency(value)}</span>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { category: string; total: number }[] }) {
  return (
    <div className={card}>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing recorded.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.category} className="flex items-center justify-between text-sm">
              <span>{r.category}</span>
              <span className="font-medium">{formatCurrency(r.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
