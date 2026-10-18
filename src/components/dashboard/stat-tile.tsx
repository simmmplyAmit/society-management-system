import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  indigo: "bg-indigo-50 text-indigo-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-slate-100 text-slate-600",
} as const;

export function StatTile({
  href,
  label,
  value,
  sub,
  icon: Icon,
  tone = "slate",
}: {
  href: string;
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  tone?: keyof typeof TONES;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl bg-card p-4 ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:ring-primary/30 hover:shadow-md"
    >
      <span className={cn("flex size-9 items-center justify-center rounded-xl", TONES[tone])}>
        <Icon className="size-[18px]" />
      </span>
      <p className="mt-3 text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold leading-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </Link>
  );
}

export function ActionRow({
  href,
  title,
  sub,
  icon: Icon,
}: {
  href: string;
  title: string;
  sub: string;
  icon: React.ElementType;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:ring-primary/30"
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </Link>
  );
}
