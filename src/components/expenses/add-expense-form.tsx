"use client";

import { useTransition } from "react";
import { addExpense } from "@/actions/expenses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

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

export function AddExpenseForm() {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await addExpense(formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Expense added");
        (document.getElementById("expense-form") as HTMLFormElement).reset();
      }
    });
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Add Expense</CardTitle>
      </CardHeader>
      <CardContent>
        <form id="expense-form" action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" name="title" placeholder="e.g. April electricity bill" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <select
                name="category"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                <option value="">— Select —</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount (₹) *</Label>
              <Input id="amount" name="amount" type="number" min="1" placeholder="0" required />
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

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Adding…" : "Add expense"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
