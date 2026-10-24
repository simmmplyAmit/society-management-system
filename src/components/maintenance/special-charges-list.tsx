"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { generateSpecialChargeNow, stopSpecialCharge } from "@/actions/special-charges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MONTHS, formatCurrency } from "@/lib/utils/month";
import { FREQUENCY_LABEL, ruleSummary, type ChargeBasis, type ChargeFrequency } from "@/lib/utils/special-charges";

export interface SpecialChargeRow {
  id: string;
  name: string;
  description: string | null;
  basis: ChargeBasis;
  rate: number;
  schedule: "ONE_TIME" | "RECURRING";
  frequency: ChargeFrequency | null;
  startMonth: number;
  startYear: number;
  endMonth: number | null;
  endYear: number | null;
  configurations: string[];
  minArea: number | null;
  maxArea: number | null;
  isActive: boolean;
  billedCount: number;
  billedTotal: number;
}

// Rates can have paise (₹1.50 per sq ft), which formatCurrency would round away
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 });

const ym = (m: number, y: number) => `${MONTHS[m - 1].slice(0, 3)} ${y}`;

export function SpecialChargesList({ charges, canManage }: { charges: SpecialChargeRow[]; canManage: boolean }) {
  if (charges.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        No other charges yet.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {charges.map((c) => (
        <ChargeCard key={c.id} charge={c} canManage={canManage} />
      ))}
    </div>
  );
}

function ChargeCard({ charge: c, canManage }: { charge: SpecialChargeRow; canManage: boolean }) {
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string } | { success: true; created?: number; missingArea?: number }>, ok: (r: { created?: number; missingArea?: number }) => string) {
    startTransition(async () => {
      const r = await action();
      if ("error" in r && r.error) return void toast.error(r.error);
      toast.success(ok(r as { created?: number; missingArea?: number }));
    });
  }

  const schedule =
    c.schedule === "ONE_TIME"
      ? `One-time · ${ym(c.startMonth, c.startYear)}`
      : `${FREQUENCY_LABEL[c.frequency ?? "MONTHLY"]} · ${ym(c.startMonth, c.startYear)} to ${ym(c.endMonth!, c.endYear!)}`;

  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{c.name}</p>
          <p className="text-xs text-muted-foreground">{schedule}</p>
        </div>
        <Badge variant={c.isActive ? "success" : "outline"}>{c.isActive ? "Active" : "Stopped"}</Badge>
      </div>

      <p className="mt-2 text-sm">
        <span className="font-semibold">{money.format(c.rate)}</span>{" "}
        <span className="text-muted-foreground">{c.basis === "FIXED" ? "per flat" : "per sq ft"}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {ruleSummary({ basis: c.basis, rate: c.rate, configurations: c.configurations, minArea: c.minArea, maxArea: c.maxArea })}
      </p>
      {c.description && <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>}
      <p className="mt-2 text-xs text-muted-foreground">
        Billed so far: <span className="font-medium text-foreground">{c.billedCount} due{c.billedCount !== 1 ? "s" : ""}</span> ·{" "}
        {formatCurrency(c.billedTotal)}
      </p>

      {c.isActive && canManage && (
        <div className="mt-3 flex gap-2">
          <Button
            type="button" variant="outline" size="sm" className="h-9 flex-1" disabled={pending}
            onClick={() => run(() => generateSpecialChargeNow(c.id), (r) => `Billed ${r.created ?? 0} new due${r.created === 1 ? "" : "s"}${r.missingArea ? `, ${r.missingArea} flat${r.missingArea === 1 ? "" : "s"} still need an area` : ""}`)}
          >
            Bill again
          </Button>
          <Button
            type="button" variant="outline" size="sm" className="h-9 flex-1 text-destructive hover:text-destructive" disabled={pending}
            onClick={() => {
              if (window.confirm(`Stop "${c.name}"? Dues already raised stay, but nothing more will be billed.`)) {
                run(() => stopSpecialCharge(c.id), () => "Charge stopped");
              }
            }}
          >
            Stop charge
          </Button>
        </div>
      )}
    </div>
  );
}
