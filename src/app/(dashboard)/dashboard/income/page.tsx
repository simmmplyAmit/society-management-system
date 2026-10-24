import { requireRole } from "@/lib/session";
import { getIncomes, getIncomeSummary } from "@/lib/queries/income";
import { formatCurrency } from "@/lib/utils/month";
import { AddIncomeForm } from "@/components/income/add-income-form";
import { IncomeList } from "@/components/income/income-list";
import { YearSelector } from "@/components/expenses/year-selector";
import { getBankAccounts } from "@/lib/queries/bank";
import { ToolSection } from "@/components/ui/tool-section";
import Link from "next/link";
import { Plus, FileText, Landmark } from "lucide-react";

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await requireRole(["ADMIN", "SECRETARY", "TREASURER"]);
  const { role, societyId } = session.user;
  const sp = await searchParams;
  const parsedYear = parseInt(sp.year ?? "", 10);
  const year = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();
  const canEdit = role === "TREASURER" || role === "ADMIN";

  const [rows, summary, accountRows] = await Promise.all([
    getIncomes(societyId!, year),
    getIncomeSummary(societyId!, year),
    getBankAccounts(societyId!),
  ]);
  const accounts = accountRows.map((a) => ({ id: a.id, name: a.name, isPrimary: a.isPrimary }));
  const incomes = rows.map((i) => ({ ...i, amount: Number(i.amount) }));
  const net = summary.incomeTotal - summary.expenseTotal;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Other income</h2>
        <YearSelector year={year} />
      </div>
      <p className="-mt-3 text-sm text-muted-foreground">
        Money the society receives apart from maintenance dues: bank interest, hall rent, scrap sales, donations.
      </p>

      <Link
        href={`/dashboard/income/statement?year=${year}`}
        className="flex items-center justify-between rounded-xl bg-card px-4 py-3 text-sm font-medium ring-1 ring-border hover:bg-muted/40"
      >
        <span className="flex items-center gap-2"><FileText className="size-4 text-primary" /> Full statement for {year}</span>
        <span className="text-xs text-muted-foreground">Dues + income vs expenses</span>
      </Link>

      <Link
        href="/dashboard/bank"
        className="flex items-center justify-between rounded-xl bg-card px-4 py-3 text-sm font-medium ring-1 ring-border hover:bg-muted/40"
      >
        <span className="flex items-center gap-2"><Landmark className="size-4 text-primary" /> Bank balance</span>
        <span className="text-xs text-muted-foreground">Tally with the statement</span>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-card p-4 ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <p className="text-xs font-medium text-muted-foreground">Other income · {year}</p>
          <p className="text-xl font-semibold text-emerald-700">{formatCurrency(summary.incomeTotal)}</p>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <p className="text-xs font-medium text-muted-foreground">Expenses · {year}</p>
          <p className="text-xl font-semibold">{formatCurrency(summary.expenseTotal)}</p>
          <p className="text-[11px] text-muted-foreground">
            {net >= 0 ? "Income covers expenses by " : "Expenses exceed this income by "}
            {formatCurrency(Math.abs(net))}
          </p>
        </div>
      </div>

      {summary.byCategory.length > 0 && (
        <div className="rounded-xl bg-card p-4 ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <p className="mb-2 text-xs font-medium text-muted-foreground">By type</p>
          <div className="space-y-1.5">
            {summary.byCategory.map((c) => (
              <div key={c.category} className="flex items-center justify-between text-sm">
                <span>{c.category}</span>
                <span className="font-medium">{formatCurrency(c.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {canEdit && (
        <ToolSection title="Add income" description="Interest, rent, donations and other receipts" icon={Plus}>
          <AddIncomeForm accounts={accounts} />
        </ToolSection>
      )}

      <IncomeList incomes={incomes} canDelete={canEdit} accounts={accounts} />
    </div>
  );
}
