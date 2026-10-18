"use client";

import { useState, useTransition } from "react";
import { markPaymentPaid, markPaymentPending } from "@/actions/maintenance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CheckCircle, XCircle } from "lucide-react";

interface MarkPaidFormProps {
  paymentId: string;
  status: "PENDING" | "PAID" | "OVERDUE";
}

export function MarkPaidForm({ paymentId, status }: MarkPaidFormProps) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  if (status === "PAID") {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="mt-1 h-7 -ml-2 px-2 text-xs text-muted-foreground hover:text-amber-700"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await markPaymentPending(paymentId);
            if (result?.error) toast.error(result.error);
            else toast.success("Marked as pending");
          })
        }
      >
        <XCircle className="h-3.5 w-3.5 mr-1" />
        Undo
      </Button>
    );
  }

  function handleSubmit(formData: FormData) {
    formData.set("paymentId", paymentId);
    startTransition(async () => {
      const result = await markPaymentPaid(formData);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Payment recorded");
        setOpen(false);
      }
    });
  }

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="mt-2 h-8 text-xs"
        onClick={() => setOpen(true)}
      >
        <CheckCircle className="mr-1 h-3.5 w-3.5" />
        Mark paid
      </Button>
    );
  }

  return (
    <form action={handleSubmit} className="mt-2 flex flex-col gap-2">
      <div className="flex gap-1.5">
        <Input
          name="utrNumber"
          placeholder="UTR / Ref no."
          className="h-9 text-sm"
        />
        <Input
          name="paidAt"
          type="date"
          className="h-9 w-36 text-sm"
          defaultValue={new Date().toISOString().split("T")[0]}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending} className="h-8 text-xs">
          {isPending ? "Saving…" : "Confirm"}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
