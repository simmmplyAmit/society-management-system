import { requireRole } from "@/lib/session";
import { COMMITTEE_ROLES } from "@/lib/queries/documents";
import { getExpiredNotices, getNotices } from "@/lib/queries/notices";
import { NoticeForm } from "@/components/notices/notice-form";
import { NoticeList } from "@/components/notices/notice-list";
import { ToolSection } from "@/components/ui/tool-section";
import { Megaphone } from "lucide-react";
import { PageTitle } from "@/components/ui/page-title";

export default async function NoticesPage() {
  const session = await requireRole(["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"]);
  const { role, societyId } = session.user;
  const canManage = COMMITTEE_ROLES.includes(role);
  const now = new Date();

  const [live, past] = await Promise.all([
    getNotices(societyId!, now),
    canManage ? getExpiredNotices(societyId!, now) : Promise.resolve([]),
  ]);
  const toRow = (n: (typeof live)[number]) => ({
    id: n.id, title: n.title, body: n.body, category: n.category, pinned: n.pinned,
    expiresOn: n.expiresOn, createdAt: n.createdAt, authorName: n.author.name,
  });

  return (
    <div className="space-y-5">
      <PageTitle emoji="📢">Notices</PageTitle>
      <p className="-mt-3 text-sm text-muted-foreground">Official announcements from the committee.</p>

      {canManage && (
        <ToolSection title="Post a notice" description="Visible to every resident" icon={Megaphone}>
          <NoticeForm />
        </ToolSection>
      )}

      <NoticeList notices={live.map(toRow)} canManage={canManage} />

      {canManage && past.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Past notices</h3>
          <NoticeList notices={past.map(toRow)} canManage={canManage} expired />
        </div>
      )}
    </div>
  );
}
