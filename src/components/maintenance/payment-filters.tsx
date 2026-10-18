"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { flatOptionLabel } from "@/lib/utils/flat";
import type { PaymentStatusFilter } from "@/lib/queries/maintenance";

interface FlatOption {
  id: string;
  number: string;
  floor: { number: number; wing: { name: string } };
}

const STATUSES: { key: PaymentStatusFilter; label: string }[] = [
  { key: "unpaid", label: "Unpaid" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
  { key: "all", label: "All" },
];

export function PaymentFilters({
  flats,
  hasWings,
  ym,
  flatId,
  status,
}: {
  flats: FlatOption[];
  hasWings: boolean;
  ym: string;
  flatId: string;
  status: PaymentStatusFilter;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`?${params.toString()}`);
  }

  const field =
    "h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[3fr_2fr] gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="f-month">
            Month
          </label>
          <div className="flex items-center gap-1">
            <input
              id="f-month"
              type="month"
              value={ym}
              onChange={(e) => update("ym", e.target.value)}
              className={cn(field, "min-w-0 flex-1 px-2")}
            />
            {ym && (
              <button
                type="button"
                aria-label="Clear month"
                onClick={() => update("ym", "")}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="f-flat">
            Flat
          </label>
          <select
            id="f-flat"
            value={flatId}
            onChange={(e) => update("flat", e.target.value)}
            className={field}
          >
            <option value="">All flats</option>
            {flats.map((f) => (
              <option key={f.id} value={f.id}>
                {flatOptionLabel(f, hasWings)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => update("status", s.key === "unpaid" ? "" : s.key)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              status === s.key
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
