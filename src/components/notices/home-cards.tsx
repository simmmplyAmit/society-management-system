import Link from "next/link";
import { getLatestNotices } from "@/lib/queries/notices";
import { getComplaintCounts } from "@/lib/queries/complaints";
import { COMMITTEE_ROLES } from "@/lib/queries/documents";
import { NOTICE_LABELS, timeAgo } from "@/lib/utils/community";
import { ChevronRight, LifeBuoy, Megaphone, Pin } from "lucide-react";
import type { Role } from "@prisma/client";

/** Latest notices and the complaint summary for the Home page. */
export async function HomeCommunityCards({ societyId, role, userId }: { societyId: string; role: Role; userId: string }) {
  const now = new Date();
  const [notices, counts] = await Promise.all([getLatestNotices(societyId, 3, now), getComplaintCounts(societyId, role, userId)]);
  const committee = COMMITTEE_ROLES.includes(role);
  const active = counts.open + counts.inProgress;

  return (
    <div className="space-y-3">
      {notices.length > 0 && (
        <div className="rounded-xl bg-card p-4 ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Megaphone className="size-4 text-primary" /> Notices</h3>
            <Link href="/dashboard/notices" className="text-xs font-medium text-primary hover:underline">See all</Link>
          </div>
          <div className="divide-y divide-border">
            {notices.map((n) => (
              <Link key={n.id} href="/dashboard/notices" className="flex items-center gap-2 py-2 text-sm hover:text-primary">
                {n.pinned && <Pin className="size-3.5 shrink-0 text-amber-600" />}
                <span className="min-w-0 flex-1 truncate font-medium">{n.title}</span>
                <span className={`shrink-0 text-[11px] ${n.category === "EMERGENCY" ? "font-semibold text-red-600" : "text-muted-foreground"}`}>
                  {n.category === "EMERGENCY" ? NOTICE_LABELS.EMERGENCY : timeAgo(n.createdAt, now)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {(committee || active > 0) && (
        <Link href="/dashboard/complaints" className="flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:bg-muted/40">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><LifeBuoy className="size-[18px]" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              {committee ? `${counts.open} open complaint${counts.open !== 1 ? "s" : ""}` : `${active} active complaint${active !== 1 ? "s" : ""}`}
            </span>
            <span className="block text-xs text-muted-foreground">
              {committee ? `${counts.inProgress} in progress · ${counts.resolved} awaiting confirmation` : "Track what the committee is doing about it"}
            </span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      )}
    </div>
  );
}
