import { requireRole } from "@/lib/session";
import { getExpenses, getExpenseAnalytics, getMemberCreditSummary, getPendingContributions } from "@/lib/queries/expenses";
import { getMemberOptions } from "@/lib/queries/flats";
import { PendingContributions } from "@/components/expenses/pending-contributions";
import { formatCurrency } from "@/lib/utils/month";
import { AddExpenseForm } from "@/components/expenses/add-expense-form";
import { ExpensesList } from "@/components/expenses/expenses-list";
import { ExpenseAnalyticsView } from "@/components/expenses/expense-analytics";
import { YearSelector } from "@/components/expenses/year-selector";
import { getBankAccounts } from "@/lib/queries/bank";
import { ToolSection } from "@/components/ui/tool-section";
import { Plus } from "lucide-react";
import { PageTitle } from "@/components/ui/page-title";

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

  const [rawExpenses, analytics, pending, credit, members, bankAccounts] = await Promise.all([
    getExpenses(societyId!, month, year),
    getExpenseAnalytics(societyId!),
    isTreasurer ? getPendingContributions(societyId!) : Promise.resolve([]),
    isTreasurer ? getMemberCreditSummary(societyId!) : Promise.resolve(null),
    isTreasurer ? getMemberOptions(societyId!) : Promise.resolve([]),
    isTreasurer ? getBankAccounts(societyId!) : Promise.resolve([]),
  ]);

  const expenses = rawExpenses.map((e) => ({
    ...e,
    amount: Number(e.amount),
    contributions: e.contributions.map((c) => ({ ...c, amount: Number(c.amount) })),
  }));

  return (
    <div className="space-y-5">
      <PageTitle emoji="💸">Expenses</PageTitle>

      <ExpenseAnalyticsView data={analytics} />

      {credit && credit.total > 0 && (
        <div className="rounded-xl bg-card p-4 ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <p className="text-xs font-medium text-muted-foreground">Owed to members (credit not yet used)</p>
          <p className="text-xl font-semibold">{formatCurrency(credit.total)}</p>
          <p className="text-xs text-muted-foreground">
            Held by {credit.members} member{credit.members !== 1 ? "s" : ""}. It reduces what they pay in maintenance, so
            the society has spent this money but not yet collected the matching dues.
          </p>
        </div>
      )}

      {isTreasurer && (
        <PendingContributions
          currentUserId={session.user.id}
          items={pending.map((c) => ({
            id: c.id,
            expenseTitle: c.expenseTitle,
            expenseAmount: Number(c.expense?.amount ?? 0),
            expenseDate: c.expense?.date ?? c.createdAt,
            receiptUrl: c.expense?.receiptUrl ?? null,
            memberName: c.member.name,
            amount: Number(c.amount),
            requestedById: c.requestedById,
            requestedByName: c.requestedBy.name,
          }))}
        />
      )}

      {isTreasurer && (
        <ToolSection title="Add expense" description="Record a new bill or payment" icon={Plus}>
          <AddExpenseForm members={members} currentUserId={session.user.id} accounts={bankAccounts.map((a) => ({ id: a.id, name: a.name, isPrimary: a.isPrimary }))} />
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
