import { ChevronDown } from "lucide-react";

// Collapsible section for secondary/admin tools. Native <details>, so no client JS.
export function ToolSection({
  title,
  description,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  description?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl bg-card ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        {Icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-[18px]" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          {description && (
            <span className="block text-xs text-muted-foreground">{description}</span>
          )}
        </span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t border-border p-2 [&_[data-slot=card]]:bg-transparent [&_[data-slot=card]]:shadow-none [&_[data-slot=card]]:ring-0">{children}</div>
    </details>
  );
}
