import Link from "next/link";
import { cn } from "@/lib/utils";

export type DuesTab = "pending" | "generate" | "charges";

const LABELS: Record<DuesTab, string> = {
  pending: "Pending",
  generate: "Generate dues",
  charges: "Charges",
};

export function DuesTabs({ tabs, active }: { tabs: DuesTab[]; active: DuesTab }) {
  if (tabs.length < 2) return null;
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1" role="tablist">
      {tabs.map((t) => (
        <Link
          key={t}
          href={t === "pending" ? "?" : `?tab=${t}`}
          role="tab"
          aria-selected={active === t}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-center text-xs font-medium transition-colors",
            active === t
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {LABELS[t]}
        </Link>
      ))}
    </div>
  );
}
