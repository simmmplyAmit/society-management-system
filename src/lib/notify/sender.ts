// Server-only. Who an email from a society appears to come from, and where replies go.
// Every society sends from the one verified EMAIL_FROM address; the society's name goes in the
// display name and replies go to its committee, so residents' answers reach people who can act.
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** dues: payments, reminders, receipts, credit (treasurer first). general: notices and complaints (secretary first). */
export type ReplyPurpose = "dues" | "general";

const PRIORITY: Record<ReplyPurpose, Role[]> = {
  dues: ["TREASURER", "ADMIN", "SECRETARY"],
  general: ["SECRETARY", "ADMIN", "TREASURER"],
};
export const MAX_REPLY_TO = 2;

export interface Sender {
  fromName?: string;
  replyTo?: string[];
}

/** Pure: picks up to MAX_REPLY_TO committee addresses in the purpose's role order, oldest member first. */
export function pickReplyTo(
  members: { email: string; role: Role; createdAt: Date }[],
  purpose: ReplyPurpose
): string[] {
  const order = PRIORITY[purpose];
  return [...members]
    .filter((m) => order.includes(m.role))
    .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.createdAt.getTime() - b.createdAt.getTime())
    .map((m) => m.email.toLowerCase())
    .filter((e, i, all) => all.indexOf(e) === i)
    .slice(0, MAX_REPLY_TO);
}

/**
 * The society's sender identity. Only active committee members with a verified email are used
 * as reply addresses. Never throws: without it the email still goes out, from the plain brand.
 */
export async function societySender(societyId: string, purpose: ReplyPurpose | null): Promise<Sender> {
  try {
    const [society, members] = await Promise.all([
      prisma.society.findUnique({ where: { id: societyId }, select: { name: true } }),
      purpose
        ? prisma.user.findMany({
            where: { societyId, isActive: true, emailVerifiedAt: { not: null }, role: { in: PRIORITY[purpose] } },
            select: { email: true, role: true, createdAt: true },
          })
        : Promise.resolve([]),
    ]);
    const replyTo = purpose ? pickReplyTo(members, purpose) : [];
    return { fromName: society?.name, ...(replyTo.length ? { replyTo } : {}) };
  } catch (err) {
    console.error("[sender] lookup failed:", err);
    return {};
  }
}

/** Caches societySender per society for one batch (the cron messages many societies in one run). */
export function senderCache(purpose: ReplyPurpose | null) {
  const cache = new Map<string, Promise<Sender>>();
  return (societyId: string) => {
    let s = cache.get(societyId);
    if (!s) {
      s = societySender(societyId, purpose);
      cache.set(societyId, s);
    }
    return s;
  };
}
