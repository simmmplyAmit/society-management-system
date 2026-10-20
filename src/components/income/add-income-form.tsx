"use client";

import { useTransition } from "react";
import { addIncome } from "@/actions/income";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const INCOME_CATEGORIES = [
  "Bank interest",
  "Fixed deposit interest",
  "Hall / clubhouse rental",
  "Parking charges",
  "Scrap / waste sale",
  "Advertising / hoarding",
  "Donation",
  "Transfer fee",
  "Fine / penalty",
  "Refund received",
  "Other",
];

const field =
  "h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function AddIncomeForm() {
  const [isPending, startTransition] = useTransition();
  const today = new Date().toISOString().split("T")[0];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await addIncome(formData);
      if (result && "error" in result && result.error) return void toast.error(result.error);
      toast.success("Income added");
      form.reset();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="inc-title">Title *</Label>
        <Input id="inc-title" name="title" placeholder="e.g. Savings account interest, Q2" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Category *</Label>
          <select name="category" className={field} required>
            <option value="">— Select —</option>
            {INCOME_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inc-amount">Amount (₹) *</Label>
          <Input id="inc-amount" name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0" required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="inc-date">Date *</Label>
          <Input id="inc-date" name="date" type="date" defaultValue={today} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inc-ref">Bank reference</Label>
          <Input id="inc-ref" name="reference" placeholder="Optional" maxLength={100} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inc-notes">Notes</Label>
        <Input id="inc-notes" name="description" placeholder="Optional details" maxLength={500} />
      </div>
      <Button type="submit" disabled={isPending} className="h-10 w-full">
        {isPending ? "Saving…" : "Add income"}
      </Button>
    </form>
  );
}
