import { requireRole } from "@/lib/session";
import { getUpiState, UPI_REQUEST_TTL_MS } from "@/lib/queries/upi";
import { UpiChangeForm } from "@/components/upi/upi-change-form";
import { PendingUpiRequest } from "@/components/upi/pending-upi-request";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/month";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { PageTitle } from "@/components/ui/page-title";

const STATUS_BADGE = {
  APPROVED: { label: "Approved", variant: "success" },
  REJECTED: { label: "Rejected", variant: "danger" },
  CANCELLED: { label: "Withdrawn", variant: "outline" },
  PENDING: { label: "Lapsed", variant: "outline" },
} as const;

export default async function UpiSettingsPage() {
  const session = await requireRole(["ADMIN", "TREASURER"]);
  const societyId = session.user.societyId!;
  const isAdmin = session.user.role === "ADMIN";
  const state = await getUpiState(societyId);
  const otherApprovers = state.approverIds.filter((id) => id !== session.user.id).length;

  return (
    <div className="space-y-5">
      <div>
        <PageTitle emoji="💳">Payment settings</PageTitle>
        <p className="text-sm text-muted-foreground">Where residents&apos; maintenance payments go</p>
      </div>

      <div className="rounded-xl bg-card p-4 ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <p className="text-xs font-medium text-muted-foreground">Current UPI ID</p>
        <p className="mt-1 break-all text-xl font-semibold">{state.upiId ?? "Not set"}</p>
        {state.upiChangedAt && (
          <p className="mt-1 text-xs text-muted-foreground">Last changed {formatDate(state.upiChangedAt)}</p>
        )}
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          Changes need approval from a different admin or the treasurer, and everyone with that role is emailed.
        </p>
      </div>

      {state.pending && (
        <PendingUpiRequest
          id={state.pending.id}
          oldUpiId={state.pending.oldUpiId}
          newUpiId={state.pending.newUpiId}
          requestedByName={state.pending.requestedBy.name}
          createdAt={state.pending.createdAt}
          expiresAt={new Date(state.pending.createdAt.getTime() + UPI_REQUEST_TTL_MS)}
          isRequester={state.pending.requestedById === session.user.id}
          canReview={state.pending.requestedById !== session.user.id}
        />
      )}

      {isAdmin && !state.pending && (
        <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <p className="text-sm font-semibold">{state.upiId ? "Change UPI ID" : "Set UPI ID"}</p>
          {state.upiId && otherApprovers === 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-600/20">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              There is no other active admin or treasurer to approve a change. Add one under Residents first.
            </p>
          )}
          <UpiChangeForm hasUpi={Boolean(state.upiId)} />
        </div>
      )}

      {!isAdmin && !state.pending && (
        <p className="text-sm text-muted-foreground">
          No change is waiting. Only an admin can request a change, and you can approve it as treasurer.
        </p>
      )}

      {state.history.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">History</h3>
          <div className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border">
            {state.history.map((r) => {
              const b = STATUS_BADGE[r.status];
              return (
                <div key={r.id} className="space-y-1 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate font-mono text-xs">
                      {r.oldUpiId ?? "none"} → <span className="font-semibold">{r.newUpiId}</span>
                    </p>
                    <Badge variant={b.variant}>{b.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(r.createdAt)} · requested by {r.requestedBy.name}
                    {r.reviewedBy ? ` · reviewed by ${r.reviewedBy.name}` : ""}
                    {r.reviewNote ? ` · ${r.reviewNote}` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
