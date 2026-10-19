"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { requestUpiChange } from "@/actions/upi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UpiChangeForm({ hasUpi }: { hasUpi: boolean }) {
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const r = await requestUpiChange(fd);
      if ("error" in r && r.error) return void toast.error(r.error);
      toast.success(
        "applied" in r && r.applied
          ? "UPI ID saved"
          : "Sent for approval. Another admin or the treasurer must approve it"
      );
      form.reset();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="upiId">{hasUpi ? "New UPI ID" : "Society UPI ID"}</Label>
        <Input
          id="upiId"
          name="upiId"
          placeholder="society@bank"
          autoComplete="off"
          autoCapitalize="none"
          required
        />
        <p className="text-xs text-muted-foreground">
          {hasUpi
            ? "The current ID stays active until a different admin or the treasurer approves the change."
            : "Residents will pay to this ID. Double-check it, because changing it later needs a second person's approval."}
        </p>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : hasUpi ? "Request change" : "Save UPI ID"}
      </Button>
    </form>
  );
}
