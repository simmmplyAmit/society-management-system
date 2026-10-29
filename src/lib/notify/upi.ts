// Server-only. Emails the people who guard the society's UPI ID. Never throws.
import { prisma } from "@/lib/prisma";
import { sendEmail } from "./email";
import { societySender } from "./sender";
import { upiChangeMessage } from "./templates";

interface Change {
  societyId: string;
  kind: "requested" | "approved" | "rejected";
  oldUpiId: string | null;
  newUpiId: string;
  requestedById: string;
  requestedByName: string;
  reviewedByName?: string;
  note?: string | null;
}

/**
 * "requested" goes to every other active admin/treasurer (they must approve);
 * decisions go to every active admin/treasurer, including the requester.
 */
export async function notifyUpiChange(c: Change): Promise<void> {
  try {
    const [society, sender, people] = await Promise.all([
      prisma.society.findUnique({ where: { id: c.societyId }, select: { name: true } }),
      // Security alert: the society's name as sender, but no reply address
      societySender(c.societyId, null),
      prisma.user.findMany({
        where: {
          societyId: c.societyId,
          isActive: true,
          role: { in: ["ADMIN", "TREASURER"] },
          emailVerifiedAt: { not: null },
          ...(c.kind === "requested" ? { id: { not: c.requestedById } } : {}),
        },
        select: { email: true },
      }),
    ]);
    const msg = upiChangeMessage({
      societyName: society?.name ?? "Your society",
      kind: c.kind,
      oldUpiId: c.oldUpiId,
      newUpiId: c.newUpiId,
      requestedBy: c.requestedByName,
      reviewedBy: c.reviewedByName,
      note: c.note,
    });
    const results = await Promise.all(people.map((p) => sendEmail({ to: p.email, ...msg, ...sender })));
    results.forEach((r) => {
      if (!r.ok) console.error("[upi-change] email failed:", r.error);
    });
  } catch (err) {
    console.error("[upi-change] notify failed:", err);
  }
}
