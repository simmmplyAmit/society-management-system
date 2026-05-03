import { requireRole } from "@/lib/session";
import { getExpenses, getExpenseSummary } from "@/actions/expenses";
import { AddExpenseForm } from "@/components/expenses/add-expense-form";
import { ExpensesList } from "@/components/expenses/expenses-list";
import { ExpenseSummary } from "@/components/expenses/expense-summary";
import { YearSelector } from "@/components/expenses/year-selector";
import { Separator } from "@/components/ui/separator";

interface SearchParams {
  year?: string;
  month?: string;
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireRole(["ADMIN", "SECRETARY", "TREASURER"]);
  const { role, societyId } = session.user;
  const sp = await searchParams;

  const year = parseInt(sp.year ?? String(new Date().getFullYear()), 10);
  const month = sp.month ? parseInt(sp.month, 10) : undefined;

  const isTreasurer = role === "TREASURER" || role === "ADMIN";

  const [rawExpenses, summary] = await Promise.all([
    getExpenses(societyId!, month, year),
    getExpenseSummary(societyId!, year),
  ]);

  const expenses = rawExpenses.map((e) => ({ ...e, amount: Number(e.amount) }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Expenses</h2>
        <YearSelector year={year} />
      </div>

      {/* Year summary */}
      <ExpenseSummary
        monthly={summary.monthly}
        byCategory={summary.byCategory}
        grandTotal={summary.grandTotal}
        year={year}
      />

      {isTreasurer && (
        <>
          <Separator />
          <AddExpenseForm />
        </>
      )}

      <Separator />

      {/* Expenses list */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
          {month
            ? `${new Date(year, month - 1).toLocaleString("default", { month: "long" })} ${year}`
            : `All expenses · ${year}`}
        </h3>
        <ExpensesList expenses={expenses} canDelete={isTreasurer} />
      </div>
    </div>
  );
}
