"use client";

import { useTransition } from "react";
import { deleteExpense } from "@/actions/expenses";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils/month";

interface Expense {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: Date;
  description: string | null;
  addedBy: { name: string };
}

interface ExpensesListProps {
  expenses: Expense[];
  canDelete: boolean;
}

function DeleteExpenseButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteExpense(id);
          if (result?.error) toast.error(result.error as string);
          else toast.success("Expense deleted");
        })
      }
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

export function ExpensesList({ expenses, canDelete }: ExpensesListProps) {
  if (expenses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        No expenses recorded for this period.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      {expenses.map((expense) => (
        <div key={expense.id} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{expense.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">{expense.category}</span>
              {" · "}
              {formatDate(expense.date)}
              {" · "}
              {expense.addedBy.name}
            </p>
            {expense.description && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{expense.description}</p>
            )}
          </div>
          <span className="shrink-0 text-sm font-semibold">{formatCurrency(expense.amount)}</span>
          {canDelete && <DeleteExpenseButton id={expense.id} />}
        </div>
      ))}
    </div>
  );
}
