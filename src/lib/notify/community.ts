// Server-only. Emails for notices and complaints. Never throws: a failed email must not undo the action.
import { prisma } from "@/lib/prisma";
import { sendEmail } from "./email";
import { societySender } from "./sender";
import { complaintMessage, noticeMessage } from "./templates";
import { translator } from "@/i18n/translate";
import type { ComplaintStatus, NoticeCategory } from "@prisma/client";

export const NOTICE_EMAIL_CAP = 200;
const CHUNK = 20;

/** Email a notice to every active, email-verified member of the society. Returns how many were sent. */
export async function emailNotice(n: {
  societyId: string;
  title: string;
  body: string;
  category: NoticeCategory;
}): Promise<{ sent: number; failed: number; capped: boolean }> {
  try {
    const [society, sender, people] = await Promise.all([
      prisma.society.findUnique({ where: { id: n.societyId }, select: { name: true } }),
      societySender(n.societyId, "general"),
      prisma.user.findMany({
        where: { societyId: n.societyId, isActive: true, emailVerifiedAt: { not: null } },
        select: { email: true, locale: true },
        take: NOTICE_EMAIL_CAP + 1,
      }),
    ]);
    const capped = people.length > NOTICE_EMAIL_CAP;
    const recipients = people.slice(0, NOTICE_EMAIL_CAP);
    const byLocale = new Map<string, ReturnType<typeof noticeMessage>>();
    const msgFor = (locale: string | null) => {
      const key = locale ?? "en";
      let m = byLocale.get(key);
      if (!m) {
        m = noticeMessage(
          {
            societyName: society?.name ?? "Your society",
            title: n.title,
            body: n.body,
            categoryLabel: translator(key)(`notices.category.${n.category}`),
            emergency: n.category === "EMERGENCY",
          },
          key
        );
        byLocale.set(key, m);
      }
      return m;
    };
    let sent = 0;
    let failed = 0;
    for (let i = 0; i < recipients.length; i += CHUNK) {
      const results = await Promise.all(recipients.slice(i, i + CHUNK).map((p) => sendEmail({ to: p.email, ...msgFor(p.locale), ...sender })));
      for (const r of results) {
        if (r.ok) sent++;
        else {
          failed++;
          console.error("[notice] email failed:", r.error);
        }
      }
    }
    return { sent, failed, capped };
  } catch (err) {
    console.error("[notice] notify failed:", err);
    return { sent: 0, failed: 0, capped: false };
  }
}

/**
 * raised → ADMIN/SECRETARY (the people who handle complaints) and the assignee, if any;
 * reply / status → the resident who raised it.
 */
export async function notifyComplaint(c: {
  societyId: string;
  complaintId: string;
  title: string;
  kind: "raised" | "reply" | "status";
  actorId: string;
  actorName: string;
  detail: string;
  raisedById: string;
  assignedToId?: string | null;
  /** Status changes: the new status and the committee's note, so each email can say it in its language. */
  toStatus?: ComplaintStatus;
  note?: string | null;
}): Promise<void> {
  try {
    const toCommittee = c.kind === "raised";
    const [society, sender, people] = await Promise.all([
      prisma.society.findUnique({ where: { id: c.societyId }, select: { name: true } }),
      // Residents' replies go to the committee; a new complaint is already addressed to the committee
      societySender(c.societyId, toCommittee ? null : "general"),
      prisma.user.findMany({
        where: {
          societyId: c.societyId,
          isActive: true,
          emailVerifiedAt: { not: null },
          id: { not: c.actorId },
          ...(toCommittee
            ? { OR: [{ role: { in: ["ADMIN", "SECRETARY"] } }, ...(c.assignedToId ? [{ id: c.assignedToId }] : [])] }
            : { id: c.raisedById }),
        },
        select: { email: true, locale: true },
      }),
    ]);
    const msgFor = (locale: string | null) =>
      complaintMessage(
        {
          societyName: society?.name ?? "Your society",
          complaintId: c.complaintId,
          title: c.title,
          kind: c.kind,
          actorName: c.actorName,
          detail: c.detail,
          toCommittee,
          statusLabel: c.toStatus ? translator(locale)(`complaints.status.${c.toStatus}`) : undefined,
          note: c.note,
        },
        locale
      );
    const results = await Promise.all(people.map((p) => sendEmail({ to: p.email, ...msgFor(p.locale), ...sender })));
    results.forEach((r) => {
      if (!r.ok) console.error("[complaint] email failed:", r.error);
    });
  } catch (err) {
    console.error("[complaint] notify failed:", err);
  }
}
