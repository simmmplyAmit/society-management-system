import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { COMMITTEE_ROLES } from "@/lib/queries/documents";
import { getAssignees, getComplaint } from "@/lib/queries/complaints";
import { ComplaintThread } from "@/components/complaints/complaint-thread";
import { PriorityBadge, StatusBadge } from "@/components/complaints/complaint-badges";
import { COMPLAINT_LABELS, withinReopenWindow } from "@/lib/utils/community";
import { flatLabel } from "@/lib/utils/flat";
import { formatDate } from "@/lib/utils/month";
import { ChevronLeft, Paperclip } from "lucide-react";
import { COMPLAINT_EMOJI } from "@/lib/utils/emoji";

export default async function ComplaintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"]);
  const { role, societyId, id: userId } = session.user;
  const { id } = await params;
  const committee = COMMITTEE_ROLES.includes(role);
  const now = new Date();

  const [complaint, society, assignees] = await Promise.all([
    getComplaint(societyId!, role, userId, id),
    prisma.society.findUnique({ where: { id: societyId! }, select: { hasWings: true } }),
    committee ? getAssignees(societyId!) : Promise.resolve([]),
  ]);
  if (!complaint) notFound(); // someone else's complaint looks the same as a missing one

  const isRaiser = complaint.raisedById === userId;
  const hasWings = society?.hasWings ?? true;
  const since = complaint.status === "CLOSED" ? complaint.closedAt : complaint.resolvedAt;

  return (
    <div className="space-y-5">
      <Link href="/dashboard/complaints" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Complaints
      </Link>

      <div className="rounded-xl bg-card p-4 ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="mb-1 flex flex-wrap gap-1.5"><StatusBadge status={complaint.status} /><PriorityBadge priority={complaint.priority} /></div>
        <h2 className="text-lg font-semibold leading-snug">{complaint.title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <span aria-hidden="true">{COMPLAINT_EMOJI[complaint.category]}</span> {COMPLAINT_LABELS[complaint.category]} · raised by {complaint.raisedBy.name} on {formatDate(complaint.createdAt)}
          {complaint.flat ? ` · ${flatLabel(complaint.flat, hasWings)}` : ""}
          {complaint.assignedTo ? ` · handled by ${complaint.assignedTo.name}` : ""}
        </p>
        {committee && complaint.raisedBy.phone && <p className="mt-0.5 text-xs text-muted-foreground">Phone: {complaint.raisedBy.phone}</p>}
        <p className="mt-3 whitespace-pre-line text-sm">{complaint.description}</p>
        {complaint.documents.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {complaint.documents.map((d) => (
              <a key={d.id} href={`/api/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/20" title={d.fileName}>
                <Paperclip className="size-3 shrink-0" /> <span className="truncate">{d.fileName}</span>
              </a>
            ))}
          </div>
        )}
        {complaint.resolutionNote && complaint.status !== "OPEN" && complaint.status !== "IN_PROGRESS" && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <b>Resolution:</b> {complaint.resolutionNote}
          </p>
        )}
      </div>

      <ComplaintThread
        complaintId={complaint.id}
        status={complaint.status}
        now={now}
        isCommittee={committee}
        isRaiser={isRaiser}
        canReopen={withinReopenWindow(since, now)}
        assignees={assignees.map((a) => ({ id: a.id, name: a.name }))}
        assignedToId={complaint.assignedTo?.id ?? null}
        items={complaint.updates.map((u) => ({
          id: u.id, kind: u.kind, body: u.body, internal: u.internal, toStatus: u.toStatus, createdAt: u.createdAt,
          authorName: u.author.name, authorIsCommittee: COMMITTEE_ROLES.includes(u.author.role),
        }))}
      />
    </div>
  );
}
