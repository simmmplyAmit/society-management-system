"use client";

import { useTransition, useState, useMemo } from "react";
import { setMaintenanceCharge } from "@/actions/maintenance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { MONTHS } from "@/lib/utils/month";
import { flatOptionLabel } from "@/lib/utils/flat";

interface Flat {
  id: string;
  number: string;
  floor: { number: number; wing: { name: string } };
}

interface SetChargeFormProps {
  flats: Flat[];
  hasWings: boolean;
}

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 2000 + 2 }, (_, i) => currentYear + 1 - i);

export function SetChargeForm({ flats, hasWings }: SetChargeFormProps) {
  const [isPending, startTransition] = useTransition();
  const [hasEndDate, setHasEndDate] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const options = useMemo(
    () => flats.map((f) => ({ id: f.id, label: flatOptionLabel(f, hasWings) })),
    [flats, hasWings]
  );
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, search]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectVisible() {
    setSelected((prev) => new Set([...prev, ...visible.map((o) => o.id)]));
  }

  function handleSubmit(formData: FormData) {
    if (selected.size === 0) {
      toast.error("Select at least one flat");
      return;
    }
    if (!hasEndDate) {
      formData.delete("endMonth");
      formData.delete("endYear");
    }
    formData.delete("flatId");
    selected.forEach((id) => formData.append("flatId", id));

    startTransition(async () => {
      const result = await setMaintenanceCharge(formData);
      if (result.error !== undefined) {
        toast.error(result.error);
      } else {
        toast.success(
          result.created === 1 ? "Maintenance charge set" : `Maintenance charge set for ${result.created} flats`
        );
        (document.getElementById("charge-form") as HTMLFormElement).reset();
        setHasEndDate(false);
        setSelected(new Set());
        setSearch("");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Set Maintenance Charge</CardTitle>
      </CardHeader>
      <CardContent>
        <form id="charge-form" action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Flats * <span className="font-normal text-muted-foreground">({selected.size} selected)</span></Label>
              <div className="flex gap-2 text-xs">
                <button type="button" className="text-primary hover:underline" onClick={selectVisible}>
                  Select all{search.trim() ? " shown" : ""}
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:underline"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </button>
              </div>
            </div>
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search flats (e.g. 101, Wing A)"
              className="h-8 text-sm"
            />
            <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-md border border-input p-1">
              {visible.map((o) => (
                <label
                  key={o.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(o.id)}
                    onChange={() => toggle(o.id)}
                    className="rounded"
                  />
                  {o.label}
                </label>
              ))}
              {visible.length === 0 && (
                <p className="px-2 py-1 text-sm text-muted-foreground">No flats found.</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amount">Monthly Amount (₹) *</Label>
            <Input id="amount" name="amount" type="number" min="1" placeholder="e.g. 2000" required />
          </div>

          <div className="space-y-1.5">
            <Label>Applicable From *</Label>
            <div className="grid grid-cols-2 gap-2">
              <select
                name="startMonth"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                defaultValue={new Date().getMonth() + 1}
                required
              >
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                name="startYear"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                defaultValue={new Date().getFullYear()}
                required
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="hasEndDate"
              checked={hasEndDate}
              onChange={(e) => setHasEndDate(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="hasEndDate" className="font-normal text-sm">Set end date (optional)</Label>
          </div>

          {hasEndDate && (
            <div className="space-y-1.5">
              <Label>Valid Until</Label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  name="endMonth"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  defaultValue={new Date().getMonth() + 1}
                >
                  {MONTHS.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
                <select
                  name="endYear"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  defaultValue={new Date().getFullYear()}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" placeholder="e.g. Regular maintenance" />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Saving…" : selected.size > 1 ? `Set charge for ${selected.size} flats` : "Set charge"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
