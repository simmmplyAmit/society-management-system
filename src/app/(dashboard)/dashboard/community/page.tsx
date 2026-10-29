import Link from "next/link";
import { requireRole } from "@/lib/session";
import { COMMITTEE_ROLES } from "@/lib/queries/documents";
import { getPosts } from "@/lib/queries/community";
import { PostComposer } from "@/components/community/post-composer";
import { PostCard } from "@/components/community/post-card";
import { POST_CATEGORIES, POST_LABELS } from "@/lib/utils/community";
import type { PostCategory } from "@prisma/client";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTitle } from "@/components/ui/page-title";
import { POST_EMOJI } from "@/lib/utils/emoji";

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const session = await requireRole(["ADMIN", "SECRETARY", "TREASURER", "OWNER", "TENANT"]);
  const { role, societyId, id: userId } = session.user;
  const sp = await searchParams;
  const category = POST_CATEGORIES.includes(sp.cat as PostCategory) ? (sp.cat as PostCategory) : undefined;
  const isCommittee = COMMITTEE_ROLES.includes(role);
  const now = new Date();

  const posts = await getPosts(societyId!, role, { category });
  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset ${active ? "bg-primary text-primary-foreground ring-primary" : "bg-card text-muted-foreground ring-border hover:bg-muted"}`;

  return (
    <div className="space-y-5">
      <PageTitle emoji="💬">Community</PageTitle>
      <p className="-mt-3 text-sm text-muted-foreground">Talk to your neighbours: recommendations, lost and found, events and more.</p>

      <PostComposer />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Link href="/dashboard/community" className={chip(!category)}>All</Link>
        {POST_CATEGORIES.map((c) => (
          <Link key={c} href={`/dashboard/community?cat=${c}`} className={chip(c === category)}>{POST_EMOJI[c]} {POST_LABELS[c]}</Link>
        ))}
      </div>

      {posts.length === 0 ? (
        <EmptyState emoji="🌱">Nothing here yet. Be the first to post.</EmptyState>
      ) : (
        <div className="stagger space-y-3">
          {posts.map((p) => (
            <PostCard
              key={p.id}
              now={now}
              userId={userId}
              isCommittee={isCommittee}
              post={{
                id: p.id, category: p.category, body: p.body, hidden: p.status === "HIDDEN", hiddenReason: p.hiddenReason,
                createdAt: p.createdAt,
                author: { id: p.author.id, name: p.author.name, isCommittee: COMMITTEE_ROLES.includes(p.author.role) },
                comments: p.comments.map((c) => ({ id: c.id, body: c.body, hidden: c.status === "HIDDEN", createdAt: c.createdAt, author: c.author })),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
