"use client";

import { useTransition } from "react";
import { deleteMaintenanceCharge } from "@/actions/maintenance";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, monthLabel } from "@/lib/utils/month";
import { flatLabel } from "@/lib/utils/flat";

interface Charge {
  id: string;
  amount: string | number;
  startMonth: number;
  startYear: number;
  endMonth: number | null;
  endYear: number | null;
  description: string | null;
  flat: {
    number: string;
    floor: { number: number; wing: { name: string } };
  };
}

interface ChargesListProps {
  charges: Charge[];
  isAdmin: boolean;
  hasWings: boolean;
}

function DeleteChargeButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 w-7 p-0 text-slate-400 hover:text-destructive"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteMaintenanceCharge(id);
          if (result?.error) toast.error(result.error);
          else toast.success("Charge removed");
        })
      }
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

export function ChargesList({ charges, isAdmin, hasWings }: ChargesListProps) {
  if (charges.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No charges set yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {charges.map((charge) => {
        const isOpenEnded = !charge.endMonth;
        return (
          <Card key={charge.id}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">
                      {flatLabel(charge.flat, hasWings)}
                    </span>
                    <span className="text-sm font-bold text-slate-800">
                      {formatCurrency(charge.amount)}/mo
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {monthLabel(charge.startMonth, charge.startYear)} →{" "}
                    {isOpenEnded
                      ? "ongoing"
                      : monthLabel(charge.endMonth!, charge.endYear!)}
                  </p>
                  {charge.description && (
                    <p className="text-xs text-muted-foreground">{charge.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge
                    variant={isOpenEnded ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {isOpenEnded ? "Active" : "Expired"}
                  </Badge>
                  {isAdmin && <DeleteChargeButton id={charge.id} />}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
