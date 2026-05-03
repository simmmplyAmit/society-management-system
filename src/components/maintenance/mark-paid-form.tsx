"use client";

import { useTransition } from "react";
import { markPaymentPaid, markPaymentPending } from "@/actions/maintenance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle, XCircle } from "lucide-react";

interface MarkPaidFormProps {
  paymentId: string;
  status: "PENDING" | "PAID" | "OVERDUE";
}

export function MarkPaidForm({ paymentId, status }: MarkPaidFormProps) {
  const [isPending, startTransition] = useTransition();

  if (status === "PAID") {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs text-amber-600 px-2"
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
      else toast.success("Payment recorded");
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-1.5 mt-1">
      <div className="flex gap-1.5">
        <Input
          name="utrNumber"
          placeholder="UTR / Ref no."
          className="h-7 text-xs"
        />
        <Input
          name="paidAt"
          type="date"
          className="h-7 text-xs w-32"
          defaultValue={new Date().toISOString().split("T")[0]}
        />
      </div>
      <Button type="submit" size="sm" disabled={isPending} className="h-7 text-xs">
        <CheckCircle className="h-3.5 w-3.5 mr-1" />
        {isPending ? "Saving…" : "Mark paid"}
      </Button>
    </form>
  );
}
