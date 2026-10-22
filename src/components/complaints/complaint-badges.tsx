import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/utils/community";
import type { ComplaintPriority, ComplaintStatus } from "@prisma/client";

const STATUS_STYLE: Record<ComplaintStatus, string> = {
  OPEN: "bg-amber-50 text-amber-700 ring-amber-600/20",
  IN_PROGRESS: "bg-sky-50 text-sky-700 ring-sky-600/20",
  RESOLVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  CLOSED: "bg-muted text-muted-foreground ring-border",
};

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${STATUS_STYLE[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: ComplaintPriority }) {
  if (priority !== "URGENT") return null;
  return <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">{PRIORITY_LABELS[priority]}</span>;
}
