"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createSpecialCharge } from "@/actions/special-charges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { MONTHS, formatCurrency } from "@/lib/utils/month";
import {
  FREQUENCY_LABEL, normalizeConfig, previewCharge, totalPeriods,
  type ChargeBasis, type ChargeFrequency, type ChargeSchedule,
} from "@/lib/utils/special-charges";
import type { FlatDetail } from "@/lib/queries/flats";

const select =
  "h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function Segmented<T extends string>({
  value, onChange, options, name,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; name: string }) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1" role="radiogroup">
      <input type="hidden" name={name} value={value} />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
            value === o.value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function MonthYear({
  prefix, value, onChange, years,
}: {
  prefix: string;
  value: { month: number; year: number };
  onChange: (v: { month: number; year: number }) => void;
  years: number[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <select
        name={`${prefix}Month`}
        value={value.month}
        onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
        className={select}
        aria-label={`${prefix} month`}
      >
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select
        name={`${prefix}Year`}
        value={value.year}
        onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
        className={select}
        aria-label={`${prefix} year`}
      >
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}

export function SpecialChargeForm({ flats }: { flats: FlatDetail[] }) {
  const now = new Date();
  const years = Array.from({ length: 8 }, (_, i) => now.getFullYear() - 1 + i);
  const [pending, startTransition] = useTransition();

  const [schedule, setSchedule] = useState<ChargeSchedule>("ONE_TIME");
  const [frequency, setFrequency] = useState<ChargeFrequency>("MONTHLY");
  const [basis, setBasis] = useState<ChargeBasis>("FIXED");
  const [rate, setRate] = useState("");
  const [configs, setConfigs] = useState<string[]>([]);
  const [minArea, setMinArea] = useState("");
  const [maxArea, setMaxArea] = useState("");
  const [start, setStart] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [end, setEnd] = useState({ month: 12, year: now.getFullYear() });

  // Configurations actually present in the society, e.g. "2BHK", shown as they were typed
  const availableConfigs = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of flats) {
      const key = normalizeConfig(f.configuration);
      if (key && !m.has(key)) m.set(key, f.configuration!.trim());
    }
    return [...m].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  }, [flats]);

  const preview = useMemo(
    () =>
      previewCharge(
        flats.map((f) => ({ configuration: f.configuration, areaSqFt: f.areaSqFt })),
        {
          basis, rate: Number(rate) || 0, configurations: configs,
          minArea: minArea ? Number(minArea) : null, maxArea: maxArea ? Number(maxArea) : null,
        }
      ),
    [flats, basis, rate, configs, minArea, maxArea]
  );
  const periods = totalPeriods({
    schedule, frequency: schedule === "RECURRING" ? frequency : null,
    startMonth: start.month, startYear: start.year,
    endMonth: schedule === "RECURRING" ? end.month : null, endYear: schedule === "RECURRING" ? end.year : null,
  });

  function toggleConfig(key: string) {
    setConfigs((c) => (c.includes(key) ? c.filter((x) => x !== key) : [...c, key]));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    for (const c of configs) fd.append("configuration", c);
    startTransition(async () => {
      const r = await createSpecialCharge(fd);
      if ("error" in r && r.error) return void toast.error(r.error);
      const res = r as { created: number; missingArea: number; notified?: { sent: number } };
      toast.success(
        `Charge created. ${res.created} due${res.created !== 1 ? "s" : ""} raised` +
          (res.missingArea ? `, ${res.missingArea} flat${res.missingArea !== 1 ? "s" : ""} skipped (no area)` : "") +
          (res.notified ? `, ${res.notified.sent} message${res.notified.sent !== 1 ? "s" : ""} sent` : "")
      );
      form.reset();
      setRate(""); setConfigs([]); setMinArea(""); setMaxArea("");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="sc-name">Charge name</Label>
        <Input id="sc-name" name="name" placeholder="e.g. Sinking fund, Water charge, Diwali celebration" maxLength={60} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sc-desc">Description (optional)</Label>
        <Input id="sc-desc" name="description" maxLength={200} placeholder="Shown to the committee only" />
      </div>

      <div className="space-y-2">
        <Label>Billing</Label>
        <Segmented
          name="schedule" value={schedule} onChange={setSchedule}
          options={[{ value: "ONE_TIME", label: "One-time" }, { value: "RECURRING", label: "Recurring" }]}
        />
        {schedule === "RECURRING" && (
          <div className="space-y-1.5">
            <Label htmlFor="sc-freq" className="text-xs text-muted-foreground">Repeats</Label>
            <select id="sc-freq" name="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as ChargeFrequency)} className={select}>
              {(Object.keys(FREQUENCY_LABEL) as ChargeFrequency[]).map((f) => (
                <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{schedule === "ONE_TIME" ? "Billing month" : "From"}</Label>
          <MonthYear prefix="start" value={start} onChange={setStart} years={years} />
        </div>
        {schedule === "RECURRING" && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">To (last billing month)</Label>
            <MonthYear prefix="end" value={end} onChange={setEnd} years={years} />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Amount</Label>
        <Segmented
          name="basis" value={basis} onChange={setBasis}
          options={[{ value: "FIXED", label: "Fixed per flat" }, { value: "PER_SQFT", label: "Per sq ft" }]}
        />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">₹</span>
          <Input
            name="rate" type="number" inputMode="decimal" min="0.01" step="0.01" required
            value={rate} onChange={(e) => setRate(e.target.value)}
            placeholder={basis === "FIXED" ? "Amount per flat" : "Rate per sq ft"}
            aria-label="Amount"
          />
          <span className="shrink-0 text-xs text-muted-foreground">{basis === "FIXED" ? "per flat" : "× area"}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Applies to</Label>
        {availableConfigs.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {availableConfigs.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={configs.includes(key)}
                onClick={() => toggleConfig(key)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  configs.includes(key)
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No flat has a configuration yet.{" "}
            <Link href="/dashboard/society" className="font-medium text-primary hover:underline">Set flat details</Link>{" "}
            to target by configuration.
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">Pick none to include every configuration.</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="sc-min" className="text-xs text-muted-foreground">Min area (sq ft)</Label>
            <Input id="sc-min" name="minArea" type="number" inputMode="decimal" min="1" step="0.01" value={minArea} onChange={(e) => setMinArea(e.target.value)} placeholder="Any" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sc-max" className="text-xs text-muted-foreground">Max area (sq ft)</Label>
            <Input id="sc-max" name="maxArea" type="number" inputMode="decimal" min="1" step="0.01" value={maxArea} onChange={(e) => setMaxArea(e.target.value)} placeholder="Any" />
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-primary/5 p-3 text-sm ring-1 ring-primary/15" aria-live="polite">
        <p className="font-semibold">
          {preview.matched} of {flats.length} flat{flats.length !== 1 ? "s" : ""} match
        </p>
        <p className="text-xs text-muted-foreground">
          {Number(rate) > 0
            ? `${formatCurrency(preview.perPeriod)} per billing across ${preview.billable} flat${preview.billable !== 1 ? "s" : ""}` +
              (periods > 1 ? ` · ${periods} billings · ${formatCurrency(preview.perPeriod * periods)} in total` : "")
            : "Enter an amount to see the total"}
        </p>
        {preview.missingArea > 0 && (
          <p className="mt-1 text-xs font-medium text-amber-700">
            {preview.missingArea} matching flat{preview.missingArea !== 1 ? "s have" : " has"} no area and will be skipped.{" "}
            <Link href="/dashboard/society" className="underline">Add areas</Link>
          </p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="notify" defaultChecked className="size-4 accent-primary" />
        Email and SMS owners about the new dues
      </label>

      <Button type="submit" className="w-full" disabled={pending || preview.billable === 0}>
        {pending ? "Creating…" : "Create charge and bill"}
      </Button>
      {preview.billable === 0 && Number(rate) > 0 && (
        <p className="text-center text-xs text-muted-foreground">No flats to bill yet. Adjust the filters or fill in flat details.</p>
      )}
    </form>
  );
}
