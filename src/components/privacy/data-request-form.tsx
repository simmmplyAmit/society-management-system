"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { requestDataChange } from "@/actions/privacy";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { REQUEST_NOTE_MAX } from "@/lib/privacy";

export function DataRequestForm() {
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const r = await requestDataChange(fd);
      if ("error" in r && r.error) return void toast.error(r.error);
      toast.success("Request sent to your society admin");
      form.reset();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label>What do you need?</Label>
        <select
          name="type"
          defaultValue="CORRECTION"
          className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="CORRECTION">✏️ Correct my details</option>
          <option value="ERASURE">🗑️ Erase my personal data</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dr-note">Details</Label>
        <Textarea id="dr-note" name="note" maxLength={REQUEST_NOTE_MAX} rows={3} placeholder="What should be corrected, or anything we should know about erasing your data" />
      </div>
      <p className="text-xs text-muted-foreground">
        Erasing closes your account. Records the law requires your society to keep, such as dues and receipts, stay without your name.
      </p>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Sending…" : "Send request"}</Button>
    </form>
  );
}
