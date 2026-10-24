"use client";

import { useTransition } from "react";
import { addIncome, updateIncome } from "@/actions/income";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AttachmentsField } from "@/components/documents/attachments";
import { uploadAttachments } from "@/lib/client/upload-documents";
import { useState } from "react";
import { AccountFields, type AccountOption } from "@/components/bank/account-fields";

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

export interface IncomeInitial {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: Date;
  description: string | null;
  reference: string | null;
  receivedVia?: "BANK" | "CASH";
  bankAccountId?: string | null;
}

export function AddIncomeForm({
  initial,
  onDone,
  accounts = [],
}: {
  initial?: IncomeInitial;
  onDone?: () => void;
  accounts?: AccountOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [files, setFiles] = useState<File[]>([]);
  const today = new Date().toISOString().split("T")[0];
  const d = initial?.date ? new Date(initial.date) : null;
  const dateValue = d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    : today;
  const categories =
    initial && !INCOME_CATEGORIES.includes(initial.category) ? [...INCOME_CATEGORIES, initial.category] : INCOME_CATEGORIES;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = initial ? await updateIncome(initial.id, formData) : await addIncome(formData);
      if (result && "error" in result && result.error) return void toast.error(result.error);
      toast.success(initial ? "Income updated" : "Income added");
      if (initial) return void onDone?.();
      form.reset();
      const incomeId = (result as { incomeId?: string }).incomeId;
      if (files.length > 0 && incomeId) {
        const up = await uploadAttachments(files, { incomeId }, { category: "OTHER", titlePrefix: String(formData.get("title") ?? "Income") });
        if (up.uploaded) toast.success(`${up.uploaded} file${up.uploaded !== 1 ? "s" : ""} attached`);
        up.errors.forEach((m) => toast.error(`${m}. Open the entry to attach it again`));
      }
      setFiles([]);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="inc-title">Title *</Label>
        <Input id="inc-title" name="title" defaultValue={initial?.title} placeholder="e.g. Savings account interest, Q2" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Category *</Label>
          <select name="category" className={field} defaultValue={initial?.category ?? ""} required>
            <option value="">— Select —</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inc-amount">Amount (₹) *</Label>
          <Input id="inc-amount" name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" defaultValue={initial?.amount} placeholder="0" required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="inc-date">Date *</Label>
          <Input id="inc-date" name="date" type="date" defaultValue={dateValue} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inc-ref">Bank reference</Label>
          <Input id="inc-ref" name="reference" defaultValue={initial?.reference ?? ""} placeholder="Optional" maxLength={100} />
        </div>
      </div>
      <AccountFields
        accounts={accounts}
        channelLabel="Received in"
        defaultChannel={initial?.receivedVia ?? "BANK"}
        defaultAccountId={initial?.bankAccountId}
      />
      {!initial && <AttachmentsField files={files} onChange={setFiles} />}
      <div className="space-y-1.5">
        <Label htmlFor="inc-notes">Notes</Label>
        <Input id="inc-notes" name="description" defaultValue={initial?.description ?? ""} placeholder="Optional details" maxLength={500} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending} className="h-10 flex-1">
          {isPending ? "Saving…" : initial ? "Save changes" : "Add income"}
        </Button>
        {initial && (
          <Button type="button" variant="outline" className="h-10" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
