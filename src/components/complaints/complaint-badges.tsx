"use client";

import { useTranslations } from "next-intl";
import type { ComplaintPriority, ComplaintStatus } from "@prisma/client";

const STATUS_STYLE: Record<ComplaintStatus, string> = {
  OPEN: "bg-amber-50 text-amber-700 ring-amber-600/20",
  IN_PROGRESS: "bg-sky-50 text-sky-700 ring-sky-600/20",
  RESOLVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  CLOSED: "bg-muted text-muted-foreground ring-border",
};

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  const t = useTranslations("complaints.status");
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${STATUS_STYLE[status]}`}>{t(status)}</span>;
}

export function PriorityBadge({ priority }: { priority: ComplaintPriority }) {
  const t = useTranslations("complaints.priority");
  if (priority !== "URGENT") return null;
  return <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">{t(priority)}</span>;
}
