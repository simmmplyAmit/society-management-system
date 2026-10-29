import { cn } from "@/lib/utils";

/** A friendly empty list: a floating emoji, a line of text and an optional hint. */
export function EmptyState({
  emoji,
  children,
  hint,
  className,
}: {
  emoji: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("animate-fade-up rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center", className)}>
      <div className="emoji-float text-3xl" aria-hidden="true">{emoji}</div>
      <p className="mt-2 text-sm font-medium text-foreground/80">{children}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
