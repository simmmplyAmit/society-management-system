"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportError } from "@/lib/client/report-error";

// Shown inside the dashboard (navigation stays usable) when a page fails to load.
export default function DashboardError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => reportError(error), [error]);
  return (
    <div className="mx-auto max-w-sm py-16 text-center">
      <AlertTriangle className="mx-auto size-8 text-amber-600" />
      <h2 className="mt-3 text-lg font-semibold">This page couldn&apos;t load</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        We&apos;ve been told about it. Your data is safe; please try again.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>}
      <Button className="mt-5" onClick={() => unstable_retry()}>
        Try again
      </Button>
    </div>
  );
}
