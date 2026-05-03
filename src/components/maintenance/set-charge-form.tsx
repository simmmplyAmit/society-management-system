"use client";

import { useTransition, useState } from "react";
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

  function handleSubmit(formData: FormData) {
    if (!hasEndDate) {
      formData.delete("endMonth");
      formData.delete("endYear");
    }
    startTransition(async () => {
      const result = await setMaintenanceCharge(formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Maintenance charge set");
        (document.getElementById("charge-form") as HTMLFormElement).reset();
        setHasEndDate(false);
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
            <Label>Flat *</Label>
            <select
              name="flatId"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            >
              <option value="">— Select flat —</option>
              {flats.map((f) => (
                <option key={f.id} value={f.id}>
                  {flatOptionLabel(f, hasWings)}
                </option>
              ))}
            </select>
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
            {isPending ? "Saving…" : "Set charge"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
