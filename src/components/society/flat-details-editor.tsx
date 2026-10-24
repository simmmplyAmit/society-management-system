"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateFlatDetails } from "@/actions/special-charges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { flatLabel } from "@/lib/utils/flat";
import type { FlatDetail } from "@/lib/queries/flats";

const PRESETS = ["Studio", "1 BHK", "2 BHK", "3 BHK", "4 BHK", "Penthouse", "Shop"];

interface Row {
  configuration: string;
  area: string; // kept as text while typing
}

const initial = (f: FlatDetail): Row => ({
  configuration: f.configuration ?? "",
  area: f.areaSqFt == null ? "" : String(f.areaSqFt),
});

/** Set configuration (1 BHK, 2 BHK…) and area (sq ft) per flat; other charges are targeted by these. */
export function FlatDetailsEditor({ flats, hasWings }: { flats: FlatDetail[]; hasWings: boolean }) {
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(flats.map((f) => [f.id, initial(f)])));
  const [saved, setSaved] = useState<Record<string, Row>>(rows);
  const [bulkConfig, setBulkConfig] = useState("");
  const [bulkArea, setBulkArea] = useState("");

  const changed = useMemo(
    () => flats.filter((f) => rows[f.id].configuration !== saved[f.id].configuration || rows[f.id].area !== saved[f.id].area),
    [flats, rows, saved]
  );
  const missing = flats.filter((f) => !rows[f.id].configuration.trim() || !rows[f.id].area.trim()).length;

  function setRow(id: string, patch: Partial<Row>) {
    setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  }

  function applyToEmpty() {
    setRows((r) => {
      const next = { ...r };
      for (const f of flats) {
        const cur = next[f.id];
        next[f.id] = {
          configuration: cur.configuration.trim() || bulkConfig,
          area: cur.area.trim() || bulkArea,
        };
      }
      return next;
    });
  }

  function save() {
    const payload = changed.map((f) => {
      const area = rows[f.id].area.trim();
      return {
        id: f.id,
        configuration: rows[f.id].configuration.trim() || null,
        areaSqFt: area ? Number(area) : null,
      };
    });
    if (payload.some((p) => p.areaSqFt != null && !(p.areaSqFt > 0))) return void toast.error("Area must be a positive number");
    const fd = new FormData();
    fd.set("rows", JSON.stringify(payload));
    startTransition(async () => {
      const r = await updateFlatDetails(fd);
      if ("error" in r && r.error) return void toast.error(r.error);
      toast.success(`Saved ${payload.length} flat${payload.length !== 1 ? "s" : ""}`);
      setSaved(rows);
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Other charges can be aimed at flats by configuration (for example 2 BHK) or area (sq ft), or billed per sq ft.
        {missing > 0 && <span className="font-medium text-amber-700"> {missing} flat{missing !== 1 ? "s" : ""} still missing details.</span>}
      </p>

      <datalist id="flat-config-presets">
        {PRESETS.map((p) => <option key={p} value={p} />)}
      </datalist>

      <div className="rounded-lg bg-muted/60 p-3">
        <p className="mb-2 text-xs font-medium">Fill in every empty flat at once</p>
        <div className="flex flex-wrap items-end gap-2">
          <Input
            value={bulkConfig}
            onChange={(e) => setBulkConfig(e.target.value)}
            list="flat-config-presets"
            placeholder="Configuration"
            className="h-9 min-w-0 flex-1 basis-28 text-sm"
            aria-label="Configuration to apply"
          />
          <Input
            value={bulkArea}
            onChange={(e) => setBulkArea(e.target.value)}
            type="number"
            inputMode="decimal"
            min="1"
            placeholder="Area sq ft"
            className="h-9 w-28 text-sm"
            aria-label="Area to apply"
          />
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={applyToEmpty} disabled={!bulkConfig && !bulkArea}>
            Apply to empty
          </Button>
        </div>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-lg ring-1 ring-border">
        {flats.map((f) => (
          <div key={f.id} className="flex flex-wrap items-center gap-2 bg-card px-3 py-2">
            <span className="w-full text-xs font-semibold sm:w-36">{flatLabel(f, hasWings)}</span>
            <Input
              value={rows[f.id].configuration}
              onChange={(e) => setRow(f.id, { configuration: e.target.value })}
              list="flat-config-presets"
              placeholder="e.g. 2 BHK"
              className="h-9 min-w-0 flex-1 basis-24 text-sm"
              aria-label={`Configuration of ${f.number}`}
            />
            <Input
              value={rows[f.id].area}
              onChange={(e) => setRow(f.id, { area: e.target.value })}
              type="number"
              inputMode="decimal"
              min="1"
              step="0.01"
              placeholder="sq ft"
              className="h-9 w-24 text-sm"
              aria-label={`Area of ${f.number} in sq ft`}
            />
          </div>
        ))}
      </div>

      <Button type="button" className="w-full" disabled={pending || changed.length === 0} onClick={save}>
        {pending ? "Saving…" : changed.length ? `Save ${changed.length} change${changed.length !== 1 ? "s" : ""}` : "No changes"}
      </Button>
    </div>
  );
}
