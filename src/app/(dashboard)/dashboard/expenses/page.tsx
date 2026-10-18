import { requireRole } from "@/lib/session";
import { getExpenses, getExpenseAnalytics } from "@/lib/queries/expenses";
import { AddExpenseForm } from "@/components/expenses/add-expense-form";
import { ExpensesList } from "@/components/expenses/expenses-list";
import { ExpenseAnalyticsView } from "@/components/expenses/expense-analytics";
import { YearSelector } from "@/components/expenses/year-selector";
import { ToolSection } from "@/components/ui/tool-section";
import { Plus } from "lucide-react";

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

  const [rawExpenses, analytics] = await Promise.all([
    getExpenses(societyId!, month, year),
    getExpenseAnalytics(societyId!),
  ]);

  const expenses = rawExpenses.map((e) => ({ ...e, amount: Number(e.amount) }));

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold">Expenses</h2>

      <ExpenseAnalyticsView data={analytics} />

      {isTreasurer && (
        <ToolSection title="Add expense" description="Record a new bill or payment" icon={Plus}>
          <AddExpenseForm />
        </ToolSection>
      )}

      {/* Expenses list */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {month
              ? `${new Date(year, month - 1).toLocaleString("default", { month: "long" })} ${year}`
              : `All expenses · ${year}`}
          </h3>
          <YearSelector year={year} />
        </div>
        <ExpensesList expenses={expenses} canDelete={isTreasurer} />
      </div>
    </div>
  );
}
