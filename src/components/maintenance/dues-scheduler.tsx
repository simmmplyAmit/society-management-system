"use client";

import { useTransition, useState } from "react";
import { generateDuesForRange } from "@/actions/maintenance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MONTHS } from "@/lib/utils/month";
import { flatOptionLabel } from "@/lib/utils/flat";

interface Flat {
  id: string;
  number: string;
  floor: { number: number; wing: { name: string } };
}

interface DuesSchedulerProps {
  flats: Flat[];
  hasWings: boolean;
}

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 2000 + 2 }, (_, i) => currentYear + 1 - i);

interface LogEntry {
  label: string;
  created: number;
  skipped: number;
}

interface SchedulerResult {
  totalCreated: number;
  totalSkipped: number;
  monthsProcessed: number;
  log: LogEntry[];
}

export function DuesScheduler({ flats, hasWings }: DuesSchedulerProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SchedulerResult | null>(null);

  const now = new Date();

  function handleSubmit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const res = await generateDuesForRange(formData);
      if ("error" in res && res.error) {
        toast.error(res.error);
      } else if ("success" in res && res.success) {
        setResult({
          totalCreated: res.totalCreated,
          totalSkipped: res.totalSkipped,
          monthsProcessed: res.monthsProcessed,
          log: res.log,
        });
        toast.success(
          `Done — ${res.totalCreated} records created, ${res.totalSkipped} skipped`
        );
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Bulk Dues Scheduler</CardTitle>
        <p className="text-xs text-muted-foreground">
          Generate pending dues for a date range. Leave flat blank to run for the entire society.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={handleSubmit} className="space-y-4">
          {/* Flat selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Flat (optional — blank = all flats)</label>
            <select
              name="flatId"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Entire society —</option>
              {flats.map((f) => (
                <option key={f.id} value={f.id}>
                  {flatOptionLabel(f, hasWings)}
                </option>
              ))}
            </select>
          </div>

          {/* From date */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">From *</label>
            <div className="grid grid-cols-2 gap-2">
              <select
                name="fromMonth"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                defaultValue={now.getMonth() + 1}
                required
              >
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                name="fromYear"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                defaultValue={now.getFullYear()}
                required
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* To date */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">To *</label>
            <div className="grid grid-cols-2 gap-2">
              <select
                name="toMonth"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                defaultValue={now.getMonth() + 1}
                required
              >
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                name="toYear"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                defaultValue={now.getFullYear()}
                required
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Generating…" : "Generate dues"}
          </Button>
        </form>

        {/* Results log */}
        {result && (
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {result.monthsProcessed} month{result.monthsProcessed !== 1 ? "s" : ""} processed
              </Badge>
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                {result.totalCreated} created
              </Badge>
              {result.totalSkipped > 0 && (
                <Badge variant="outline">{result.totalSkipped} skipped</Badge>
              )}
            </div>

            {result.log.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-md border text-xs divide-y">
                {result.log.map((entry) => (
                  <div key={entry.label} className="flex items-center justify-between px-3 py-1.5">
                    <span className="font-mono text-muted-foreground">{entry.label}</span>
                    <span className="flex gap-2">
                      {entry.created > 0 && (
                        <span className="text-green-700">+{entry.created}</span>
                      )}
                      {entry.skipped > 0 && (
                        <span className="text-slate-400">skip {entry.skipped}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
