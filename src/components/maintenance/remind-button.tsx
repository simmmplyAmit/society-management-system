"use client";

import { useTransition } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { sendDueReminders } from "@/actions/notifications";
import { Button } from "@/components/ui/button";

export function RemindButton({
  paymentIds,
  label = "Remind",
  confirmMessage,
  variant = "ghost",
  className,
}: {
  paymentIds: string[];
  label?: string;
  confirmMessage?: string;
  variant?: "ghost" | "outline";
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  function send() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const fd = new FormData();
    for (const id of paymentIds) fd.append("paymentId", id);
    startTransition(async () => {
      const r = await sendDueReminders(fd);
      if ("error" in r && r.error) return void toast.error(r.error);
      const res = r as { sent: number; failed: number; skipped: number };
      if (res.sent > 0) {
        toast.success(
          `Sent ${res.sent} message${res.sent !== 1 ? "s" : ""}` +
            (res.skipped ? `, ${res.skipped} skipped` : "") +
            (res.failed ? `, ${res.failed} failed` : "")
        );
      } else if (res.failed > 0) {
        toast.error(`${res.failed} message${res.failed !== 1 ? "s" : ""} failed to send`);
      } else {
        toast.info("Nothing sent: already reminded today, or no verified contact");
      }
    });
  }

  return (
    <Button type="button" size="sm" variant={variant} className={className} disabled={pending} onClick={send}>
      <BellRing className="mr-1 size-3.5" />
      {pending ? "Sending…" : label}
    </Button>
  );
}
