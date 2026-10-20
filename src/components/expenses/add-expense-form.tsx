"use client";

import { useMemo, useState, useTransition } from "react";
import { addExpense } from "@/actions/expenses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils/month";
import type { MemberOption } from "@/components/maintenance/record-deposit-form";

export const EXPENSE_CATEGORIES = [
  "Electricity",
  "Water",
  "Security",
  "Cleaning",
  "Repairs & Maintenance",
  "Gardening",
  "Lift Maintenance",
  "Generator",
  "Insurance",
  "Salary",
  "Stationery",
  "Bank Charges",
  "Other",
];

interface Row {
  userId: string;
  amount: string;
}

const field =
  "h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function AddExpenseForm({
  members = [],
  currentUserId,
}: {
  members?: MemberOption[];
  currentUserId?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  const total = Number(amount) || 0;
  const assigned = useMemo(
    () => Math.round(rows.reduce((n, r) => n + (Number(r.amount) || 0) * 100, 0)) / 100,
    [rows]
  );
  const over = assigned > total + 0.001;
  const selfTagged = currentUserId ? rows.some((r) => r.userId === currentUserId) : false;

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const filled = rows.filter((r) => r.userId || r.amount);
    if (filled.some((r) => !r.userId || !(Number(r.amount) > 0))) {
      return void toast.error("Choose a member and an amount for every row, or remove the row");
    }
    if (over) return void toast.error("Members' amounts can't add up to more than the expense");
    if (filled.length > 0) {
      formData.set("contributions", JSON.stringify(filled.map((r) => ({ userId: r.userId, amount: Number(r.amount) }))));
    }

    startTransition(async () => {
      const result = await addExpense(formData);
      if (result?.error) return void toast.error(result.error);
      const r = result as { credited?: number; pendingApproval?: number };
      toast.success(
        "Expense added" +
          (r.credited ? `. ${r.credited} member${r.credited !== 1 ? "s" : ""} credited` : "") +
          (r.pendingApproval ? `. ${r.pendingApproval} credit waiting for another admin or treasurer` : "")
      );
      form.reset();
      setAmount("");
      setRows([]);
    });
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div>
      <form id="expense-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title *</Label>
          <Input id="title" name="title" placeholder="e.g. April electricity bill" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Category *</Label>
            <select name="category" className={field} required>
              <option value="">— Select —</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount (₹) *</Label>
            <Input
              id="amount" name="amount" type="number" inputMode="decimal" min="1" step="0.01" placeholder="0" required
              value={amount} onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="date">Date *</Label>
          <Input id="date" name="date" type="date" defaultValue={today} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Notes</Label>
          <Input id="description" name="description" placeholder="Optional details" />
        </div>

        {members.length > 0 && (
          <details className="group rounded-lg border border-border bg-muted/30">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <span>
                Advanced: paid by members
                {rows.length > 0 && <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">{rows.length}</span>}
              </span>
              <span className="text-xs text-muted-foreground group-open:hidden">Optional</span>
            </summary>
            <div className="space-y-3 border-t border-border p-3">
              <p className="text-xs text-muted-foreground">
                If members paid some of this themselves, tag their amounts. Each member is credited and the credit pays
                their dues automatically. Credit can only be used for dues.
              </p>

              <div className="space-y-2">
                {rows.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={r.userId}
                      onChange={(e) => setRow(i, { userId: e.target.value })}
                      className={field}
                      aria-label={`Member ${i + 1}`}
                    >
                      <option value="">Choose member</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id} disabled={rows.some((o, j) => j !== i && o.userId === m.id)}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={r.amount}
                      onChange={(e) => setRow(i, { amount: e.target.value })}
                      type="number" inputMode="decimal" min="1" step="0.01" placeholder="₹"
                      className="w-28 shrink-0"
                      aria-label={`Amount paid by member ${i + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`Remove member ${i + 1}`}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>

              <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setRows((rs) => [...rs, { userId: "", amount: "" }])}>
                <Plus className="mr-1 size-4" /> Add member
              </Button>

              {rows.length > 0 && (
                <div className="rounded-lg bg-primary/5 p-3 text-xs ring-1 ring-primary/15" aria-live="polite">
                  <p className={over ? "font-semibold text-destructive" : "font-semibold"}>
                    Members paid {formatCurrency(assigned)} of {formatCurrency(total)}
                  </p>
                  <p className="text-muted-foreground">
                    {over ? "Their amounts can't exceed the expense." : `The society pays the remaining ${formatCurrency(Math.max(total - assigned, 0))}.`}
                  </p>
                  {selfTagged && (
                    <p className="mt-1 font-medium text-amber-700">
                      Your own credit needs approval from another admin or treasurer before it is added.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="receiptUrl">Receipt or bill link (optional)</Label>
                <Input id="receiptUrl" name="receiptUrl" type="url" placeholder="https://…" maxLength={500} />
              </div>
            </div>
          </details>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Adding…" : "Add expense"}
        </Button>
      </form>
    </div>
  );
}
