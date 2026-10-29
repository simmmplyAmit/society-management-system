import Link from "next/link";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { COMMITTEE_ROLES } from "@/lib/queries/documents";
import { getComplaintCounts, getMyFlatOptions, listComplaints } from "@/lib/queries/complaints";
import { RaiseComplaintForm } from "@/components/complaints/raise-complaint-form";
import { PriorityBadge, StatusBadge } from "@/components/complaints/complaint-badges";
import { ToolSection } from "@/components/ui/tool-section";
import { COMPLAINT_LABELS, timeAgo } from "@/lib/utils/community";
import { flatLabel, flatOptionLabel } from "@/lib/utils/flat";
import { ChevronRight, LifeBuoy } from "lucide-react";
import type { ComplaintStatus } from "@prisma/client";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTitle } from "@/components/ui/page-title";
import { COMPLAINT_EMOJI } from "@/lib/utils/emoji";

const FILTERS: { key: string; label: string; status?: ComplaintStatus | "ACTIVE" }[] = [
  { key: "active", label: "Active", status: "ACTIVE" },
  { key: "resolved", label: "Resolved", status: "RESOLVED" },
  { key: "closed", label: "Closed", status: "CLOSED" },
  { key: "all", label: "All" },
];

export default async function ComplaintsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const session = await requireRole(["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"]);
  const { role, societyId, id: userId } = session.user;
  const sp = await searchParams;
  const committee = COMMITTEE_ROLES.includes(role);
  const filter = FILTERS.find((f) => f.key === sp.f) ?? FILTERS[0];
  const now = new Date();

  const [society, rows, counts, myFlats] = await Promise.all([
    prisma.society.findUnique({ where: { id: societyId! }, select: { hasWings: true } }),
    listComplaints(societyId!, role, userId, { status: filter.status }),
    getComplaintCounts(societyId!, role, userId),
    getMyFlatOptions(societyId!, userId),
  ]);
  const hasWings = society?.hasWings ?? true;
  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset ${active ? "bg-primary text-primary-foreground ring-primary" : "bg-card text-muted-foreground ring-border hover:bg-muted"}`;

  return (
    <div className="space-y-5">
      <PageTitle emoji="🛠️">Complaints</PageTitle>
      <p className="-mt-3 text-sm text-muted-foreground">
        {committee ? "Complaints raised by residents. Only you and the resident can see each one." : "Raise a problem with the committee. Only you and the committee can see your complaints."}
      </p>

      {committee && (
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            ["Open", counts.open, "text-amber-700"],
            ["In progress", counts.inProgress, "text-sky-700"],
            ["Resolved", counts.resolved, "text-emerald-700"],
          ].map(([label, n, tone]) => (
            <div key={String(label)} className="rounded-xl bg-card p-3 ring-1 ring-border">
              <p className={`text-xl font-semibold ${tone}`}>{n}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      <ToolSection title="Raise a complaint" description="Tell the committee about a problem" icon={LifeBuoy} defaultOpen={!committee && rows.length === 0}>
        <RaiseComplaintForm flats={myFlats.map((f) => ({ id: f.id, label: flatOptionLabel(f, hasWings) }))} />
      </ToolSection>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/dashboard/complaints?f=${f.key}`} className={chip(f.key === filter.key)}>{f.label}</Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState emoji={filter.key === "active" ? "🙌" : "🗂️"}>
          {filter.key === "active" ? "No active complaints. All good!" : "Nothing here."}
        </EmptyState>
      ) : (
        <div className="stagger divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          {rows.map((c) => (
            <Link key={c.id} href={`/dashboard/complaints/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  <span aria-hidden="true">{COMPLAINT_EMOJI[c.category]}</span> {COMPLAINT_LABELS[c.category]}
                  {committee ? ` · ${c.raisedBy.name}` : ""}
                  {c.flat ? ` · ${flatLabel(c.flat, hasWings)}` : ""}
                  {" · "}{timeAgo(c.createdAt, now)}
                  {c.assignedTo ? ` · ${c.assignedTo.name}` : ""}
                </p>
                <div className="mt-1 flex gap-1"><StatusBadge status={c.status} /><PriorityBadge priority={c.priority} /></div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
