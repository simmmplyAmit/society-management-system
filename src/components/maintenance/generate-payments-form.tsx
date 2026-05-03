"use client";

import { useTransition } from "react";
import { generateMonthlyPayments } from "@/actions/maintenance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { MONTHS } from "@/lib/utils/month";

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 2000 + 2 }, (_, i) => currentYear + 1 - i);

export function GeneratePaymentsForm() {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await generateMonthlyPayments(formData);
      if (result?.error) {
        toast.error(result.error);
      } else if ("success" in result && result.success) {
        const r = result as { created: number; skipped: number };
        toast.success(
          `Generated ${r.created} records${r.skipped ? `, ${r.skipped} already existed` : ""}`
        );
      }
    });
  }

  const now = new Date();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Generate Monthly Records</CardTitle>
        <p className="text-xs text-muted-foreground">
          Creates PENDING payment entries for all flats with active charges
        </p>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5 flex-1 min-w-[120px]">
            <label className="text-sm font-medium">Month</label>
            <select
              name="month"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              defaultValue={now.getMonth() + 1}
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 min-w-[90px]">
            <label className="text-sm font-medium">Year</label>
            <select
              name="year"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              defaultValue={now.getFullYear()}
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={isPending} className="shrink-0">
            {isPending ? "Generating…" : "Generate"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
