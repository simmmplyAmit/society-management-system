"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { acceptPrivacy } from "@/actions/privacy";
import { Button } from "@/components/ui/button";
import { CONSENT_STATEMENT } from "@/lib/privacy";

export function ConsentForm() {
  const [agreed, setAgreed] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await acceptPrivacy(fd);
      if ("error" in r && r.error) return void toast.error(r.error);
      // A full page load: the router cache still holds the earlier "go to /consent" answer for /dashboard
      window.location.assign("/dashboard");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <ul className="space-y-2 rounded-xl bg-muted/50 p-4 text-sm">
        <li>🏠 We keep your name, contact details and flat so your society can run its accounts.</li>
        <li>💳 Your dues and payment records are visible to the committee, never to other residents.</li>
        <li>🔒 Phone numbers and UPI IDs are encrypted, and we never sell your data.</li>
        <li>🙋 You can download your data, correct it or ask for it to be erased from <b>Privacy &amp; my data</b>.</li>
      </ul>
      <p className="text-sm">
        <Link href="/privacy" target="_blank" className="font-medium text-primary hover:underline">Read the full Privacy Notice</Link>
      </p>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="agree"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 rounded border-input"
        />
        <span>{CONSENT_STATEMENT}</span>
      </label>
      <Button type="submit" className="h-11 w-full" disabled={!agreed || pending}>
        {pending ? "Saving…" : "Agree and continue"}
      </Button>
    </form>
  );
}
