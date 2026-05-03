"use client";

import { useTransition } from "react";
import { deleteExpense } from "@/actions/expenses";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

const CATEGORY_COLORS: Record<string, string> = {
  Electricity: "bg-yellow-100 text-yellow-700",
  Water: "bg-blue-100 text-blue-700",
  Security: "bg-slate-100 text-slate-700",
  Cleaning: "bg-green-100 text-green-700",
  "Repairs & Maintenance": "bg-orange-100 text-orange-700",
  Gardening: "bg-emerald-100 text-emerald-700",
  "Lift Maintenance": "bg-purple-100 text-purple-700",
  Generator: "bg-red-100 text-red-700",
  Insurance: "bg-indigo-100 text-indigo-700",
  Salary: "bg-pink-100 text-pink-700",
  Other: "bg-slate-100 text-slate-600",
};

function DeleteExpenseButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 w-7 p-0 text-slate-400 hover:text-destructive"
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
      <p className="text-sm text-muted-foreground text-center py-6">
        No expenses recorded yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {expenses.map((expense) => {
        const colorClass = CATEGORY_COLORS[expense.category] ?? CATEGORY_COLORS.Other;
        return (
          <Card key={expense.id}>
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm leading-tight">{expense.title}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colorClass}`}>
                          {expense.category}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(expense.date)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          by {expense.addedBy.name}
                        </span>
                      </div>
                      {expense.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{expense.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="font-semibold text-sm">{formatCurrency(expense.amount)}</span>
                      {canDelete && <DeleteExpenseButton id={expense.id} />}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
