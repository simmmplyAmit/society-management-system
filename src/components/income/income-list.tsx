"use client";

import { useTransition } from "react";
import { deleteIncome } from "@/actions/income";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils/month";

interface Income {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: Date;
  description: string | null;
  reference: string | null;
  addedBy: { name: string };
}

function DeleteIncomeButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
      disabled={isPending}
      aria-label="Delete income"
      onClick={() => {
        if (!window.confirm("Delete this income entry?")) return;
        startTransition(async () => {
          const result = await deleteIncome(id);
          if (result?.error) toast.error(result.error as string);
          else toast.success("Income deleted");
        });
      }}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

export function IncomeList({ incomes, canDelete }: { incomes: Income[]; canDelete: boolean }) {
  if (incomes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        No other income recorded for this year.
      </div>
    );
  }
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      {incomes.map((i) => (
        <div key={i.id} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{i.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">{i.category}</span>
              {" · "}
              {formatDate(i.date)}
              {" · "}
              {i.addedBy.name}
              {i.reference ? ` · Ref ${i.reference}` : ""}
            </p>
            {i.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{i.description}</p>}
          </div>
          <span className="shrink-0 text-sm font-semibold text-emerald-700">+{formatCurrency(i.amount)}</span>
          {canDelete && <DeleteIncomeButton id={i.id} />}
        </div>
      ))}
    </div>
  );
}
