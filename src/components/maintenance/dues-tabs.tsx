import Link from "next/link";
import { cn } from "@/lib/utils";

export type DuesTab = "pending" | "verify" | "generate" | "charges";

const LABELS: Record<DuesTab, string> = {
  pending: "Pending",
  verify: "To verify",
  generate: "Generate",
  charges: "Charges",
};

export function DuesTabs({
  tabs,
  active,
  counts = {},
}: {
  tabs: DuesTab[];
  active: DuesTab;
  counts?: Partial<Record<DuesTab, number>>;
}) {
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
            "flex-1 whitespace-nowrap rounded-md px-1.5 py-1.5 text-center text-xs font-medium transition-colors",
            active === t
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {LABELS[t]}
          {counts[t] ? (
            <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {counts[t]}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
