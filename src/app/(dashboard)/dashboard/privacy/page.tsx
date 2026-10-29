import Link from "next/link";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getMyDataRequests, getOpenDataRequests } from "@/lib/queries/privacy";
import { PRIVACY_VERSION } from "@/lib/privacy";
import { DataRequestForm } from "@/components/privacy/data-request-form";
import { DataRequestsAdmin } from "@/components/privacy/data-requests-admin";
import { PageTitle } from "@/components/ui/page-title";
import { ToolSection } from "@/components/ui/tool-section";
import { formatDate } from "@/lib/utils/month";
import { timeAgo } from "@/lib/utils/community";
import { Download, ShieldCheck } from "lucide-react";

const card = "rounded-xl bg-card p-4 ring-1 ring-border shadow-[0_1px_2px_rgba(16,24,40,0.04)]";
const STATUS = { OPEN: "⏳ Waiting", DONE: "✅ Done", REJECTED: "🚫 Declined" } as const;

export default async function PrivacyPage() {
  const session = await requireRole(["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"]);
  const { id: userId, societyId, role } = session.user;
  const now = new Date();

  const [me, mine, open] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { privacyAcceptedAt: true, privacyVersion: true } }),
    getMyDataRequests(societyId!, userId),
    role === "ADMIN" ? getOpenDataRequests(societyId!) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <PageTitle emoji="🔐">Privacy &amp; my data</PageTitle>
      <p className="-mt-3 text-sm text-muted-foreground">See what we hold about you, and correct or erase it.</p>

      <div className={card}>
        <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-primary" /> Privacy Notice</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {me?.privacyAcceptedAt
            ? `You agreed on ${formatDate(me.privacyAcceptedAt)} (version ${me.privacyVersion ?? "?"}${me.privacyVersion !== PRIVACY_VERSION ? ", a newer version is available" : ""}).`
            : "You haven't agreed to the current notice yet."}
        </p>
        <Link href="/privacy" target="_blank" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">Read the Privacy Notice</Link>
      </div>

      <div className={card}>
        <p className="flex items-center gap-2 text-sm font-semibold"><Download className="size-4 text-primary" /> Download my data</p>
        <p className="mt-1 text-xs text-muted-foreground">
          A file with your profile, flats, payments, complaints, posts and the messages we sent you.
        </p>
        <a href="/api/me/export" download className="mt-3 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          Download (JSON)
        </a>
      </div>

      <ToolSection title="Correct or erase my data" description="Send a request to your society admin" icon={ShieldCheck}>
        <DataRequestForm />
      </ToolSection>

      {mine.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">My requests</h3>
          <div className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border">
            {mine.map((r) => (
              <div key={r.id} className="px-4 py-3 text-sm">
                <p className="font-medium">{r.type === "ERASURE" ? "🗑️ Erase my data" : "✏️ Correct my data"} · {STATUS[r.status]}</p>
                <p className="text-xs text-muted-foreground">Sent {timeAgo(r.createdAt, now)}</p>
                {r.note && <p className="mt-1 whitespace-pre-line text-xs">{r.note}</p>}
                {r.resolutionNote && <p className="mt-1 text-xs text-muted-foreground">Reply: {r.resolutionNote}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {role === "ADMIN" && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Requests from residents</h3>
          <DataRequestsAdmin
            now={now}
            requests={open.map((r) => ({ id: r.id, type: r.type, note: r.note, createdAt: r.createdAt, userId: r.user.id, userName: r.user.name, isMine: r.user.id === userId }))}
          />
        </div>
      )}
    </div>
  );
}
