"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MONTHS, formatCurrency } from "@/lib/utils/month";
import type { ExpenseAnalytics } from "@/lib/queries/expenses";

type View = "all" | "yearly" | "monthly" | "type";

const VIEWS: { key: View; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "yearly", label: "Yearly" },
  { key: "monthly", label: "Monthly" },
  { key: "type", label: "By type" },
];

const BAR = "#4f46e5";
const PALETTE = [
  "#4f46e5", "#0ea5e9", "#10b981", "#f59e0b",
  "#f43f5e", "#8b5cf6", "#14b8a6", "#ec4899",
];
const OTHER = "#94a3b8";
const MAX_SLICES = 7;

const compact = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function tickFormatter(v: number) {
  return compact.format(v);
}

function tooltipFormatter(v: unknown) {
  return formatCurrency(Number(v));
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function SimpleBarChart({ data }: { data: { label: string; total: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={tickFormatter} width={44} />
          <Tooltip formatter={tooltipFormatter} cursor={{ fill: "#f1f5f9" }} />
          <Bar dataKey="total" name="Spent" fill={BAR} radius={[6, 6, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function YearSelect({
  years,
  value,
  onChange,
  allowAll,
}: {
  years: number[];
  value: number | "all";
  onChange: (v: number | "all") => void;
  allowAll?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) =>
        onChange(e.target.value === "all" ? "all" : Number(e.target.value))
      }
      className="h-8 rounded-md border bg-background px-2 text-sm"
      aria-label="Year"
    >
      {allowAll && <option value="all">All time</option>}
      {[...years].reverse().map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  );
}

export function ExpenseAnalyticsView({ data }: { data: ExpenseAnalytics }) {
  const latest = data.years[data.years.length - 1];
  const [view, setView] = useState<View>("all");
  const [monthYear, setMonthYear] = useState<number>(latest);
  const [typeYear, setTypeYear] = useState<number | "all">("all");

  const categoriesAll = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of data.byCategory) m.set(c.category, (m.get(c.category) ?? 0) + c.total);
    return m;
  }, [data.byCategory]);

  if (data.years.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          No expenses recorded yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-muted p-1" role="tablist">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            role="tab"
            aria-selected={view === v.key}
            onClick={() => setView(v.key)}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              view === v.key
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "all" && (
        <AllTime data={data} categories={categoriesAll} />
      )}
      {view === "yearly" && <Yearly data={data} />}
      {view === "monthly" && (
        <Monthly data={data} year={monthYear} onYear={setMonthYear} />
      )}
      {view === "type" && (
        <ByType
          data={data}
          year={typeYear}
          onYear={setTypeYear}
          allTime={categoriesAll}
        />
      )}
    </div>
  );
}

function AllTime({
  data,
  categories,
}: {
  data: ExpenseAnalytics;
  categories: Map<string, number>;
}) {
  const top = [...categories].sort((a, b) => b[1] - a[1])[0];
  const firstYear = data.years[0];
  const lastYear = data.years[data.years.length - 1];
  const avg = data.total / data.years.length;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Total spent"
          value={formatCurrency(data.total)}
          sub={firstYear === lastYear ? String(firstYear) : `${firstYear} – ${lastYear}`}
        />
        <Stat
          label="Average per year"
          value={formatCurrency(avg)}
          sub={top ? `Top: ${top[0]}` : undefined}
        />
      </div>
      <Card>
        <CardContent className="p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Spend by year</p>
          <SimpleBarChart
            data={data.yearly.map((y) => ({ label: String(y.year), total: y.total }))}
          />
        </CardContent>
      </Card>
    </>
  );
}

function Yearly({ data }: { data: ExpenseAnalytics }) {
  const rows = data.yearly.map((y, i) => {
    const prev = i > 0 ? data.yearly[i - 1].total : null;
    const change = prev && prev > 0 ? ((y.total - prev) / prev) * 100 : null;
    return { ...y, change };
  });
  return (
    <>
      <Card>
        <CardContent className="p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Yearly totals</p>
          <SimpleBarChart
            data={data.yearly.map((y) => ({ label: String(y.year), total: y.total }))}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-2 p-4">
          {[...rows].reverse().map((r) => (
            <div key={r.year} className="flex items-center justify-between text-sm">
              <span className="font-medium">{r.year}</span>
              <span className="flex items-center gap-3">
                {r.change !== null && (
                  <span
                    className={cn(
                      "text-[11px]",
                      r.change > 0 ? "text-red-600" : "text-emerald-600"
                    )}
                  >
                    {r.change > 0 ? "▲" : "▼"} {Math.abs(r.change).toFixed(0)}%
                  </span>
                )}
                <span className="font-semibold">{formatCurrency(r.total)}</span>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function Monthly({
  data,
  year,
  onYear,
}: {
  data: ExpenseAnalytics;
  year: number;
  onYear: (y: number) => void;
}) {
  const series = MONTHS.map((name, i) => ({
    label: name.slice(0, 3),
    total:
      data.monthly.find((m) => m.year === year && m.month === i + 1)?.total ?? 0,
  }));
  const yearTotal = series.reduce((s, m) => s + m.total, 0);
  const active = series.filter((m) => m.total > 0);
  const peak = active.reduce<(typeof series)[number] | null>(
    (best, m) => (!best || m.total > best.total ? m : best),
    null
  );
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Month by month</p>
        <YearSelect
          years={data.years}
          value={year}
          onChange={(v) => onYear(v as number)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label={`Total ${year}`} value={formatCurrency(yearTotal)} />
        <Stat
          label="Highest month"
          value={peak ? formatCurrency(peak.total) : "—"}
          sub={peak?.label}
        />
      </div>
      <Card>
        <CardContent className="p-4">
          <SimpleBarChart data={series} />
        </CardContent>
      </Card>
    </>
  );
}

function ByType({
  data,
  year,
  onYear,
  allTime,
}: {
  data: ExpenseAnalytics;
  year: number | "all";
  onYear: (y: number | "all") => void;
  allTime: Map<string, number>;
}) {
  const totals =
    year === "all"
      ? allTime
      : new Map(
          data.byCategory
            .filter((c) => c.year === year)
            .map((c) => [c.category, c.total] as const)
        );
  const sorted = [...totals].sort((a, b) => b[1] - a[1]);
  const sum = sorted.reduce((s, [, t]) => s + t, 0);
  const head = sorted.slice(0, MAX_SLICES);
  const rest = sorted.slice(MAX_SLICES).reduce((s, [, t]) => s + t, 0);
  const slices = [
    ...head.map(([name, total], i) => ({ name, total, color: PALETTE[i % PALETTE.length] })),
    ...(rest > 0 ? [{ name: "Other", total: rest, color: OTHER }] : []),
  ];
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Spend by type</p>
        <YearSelect years={data.years} value={year} onChange={onYear} allowAll />
      </div>
      <Card>
        <CardContent className="p-4">
          {sum === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses for this period.</p>
          ) : (
            <>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={slices}
                      dataKey="total"
                      nameKey="name"
                      innerRadius="55%"
                      outerRadius="90%"
                      paddingAngle={1}
                      stroke="none"
                    >
                      {slices.map((s) => (
                        <Cell key={s.name} fill={s.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={tooltipFormatter} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-2">
                {slices.map((s) => (
                  <div key={s.name} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: s.color }}
                      />
                      <span className="truncate">{s.name}</span>
                    </span>
                    <span className="shrink-0">
                      <span className="mr-2 text-[11px] text-muted-foreground">
                        {((s.total / sum) * 100).toFixed(0)}%
                      </span>
                      <span className="font-semibold">{formatCurrency(s.total)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
